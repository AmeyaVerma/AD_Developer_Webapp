// Checks the digital signature inside a PDF (PAdES / adbe.pkcs7.detached) without trusting anything the uploader says.
import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';

// An explicit crypto engine is passed to every pkijs call, so no global engine is needed (works in Node and Deno).
const cryptoEngine = new pkijs.CryptoEngine({ name: 'webcrypto', crypto: globalThis.crypto, subtle: globalThis.crypto.subtle });

const latin1 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode(...u8.subarray(i, i + 8192)); return s; };
const hexToBytes = (h) => { const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16); return o; };
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const OID = { signingTime: '1.2.840.113549.1.9.5', CN: '2.5.4.3', O: '2.5.4.10', OU: '2.5.4.11', C: '2.5.4.6', ST: '2.5.4.8', SERIAL: '2.5.4.5' };

export const sha256Hex = async (u8) => toHex(await crypto.subtle.digest('SHA-256', u8));

const nameOf = (rdn) => {
  const o = {};
  for (const tv of rdn.typesAndValues) {
    const k = Object.keys(OID).find((x) => OID[x] === tv.type);
    if (k) o[k] = tv.value.valueBlock.value;
  }
  return o;
};
export const pemToDer = (pem) => Uint8Array.from(atob(pem.replace(/-----[^-]+-----|\s+/g, '')), (c) => c.charCodeAt(0));

export async function inspectPdf(bytes, trustedRootsPem = []) {
  const sha256 = await sha256Hex(bytes);
  const text = latin1(bytes);
  const m = [...text.matchAll(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g)];
  if (!m.length) return { status: 'unsigned', reason: 'This PDF carries no digital signature.', sha256 };

  let last = null;
  for (const hit of m) {
    const br = hit.slice(1, 5).map(Number);
    const [a, b, c, d] = br;
    if (a !== 0 || b <= 0 || c < b || c + d > bytes.length) return { status: 'invalid', reason: 'The signature ranges are malformed.', sha256 };
    const gap = text.slice(b, c);
    const hex = gap.replace(/^\s*</, '').replace(/>\s*$/, '').replace(/\s+/g, '');
    if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2) return { status: 'invalid', reason: 'The signature data is unreadable.', sha256 };

    let signedData;
    try {
      const der = hexToBytes(hex);
      const asn = asn1js.fromBER(der.buffer.slice(der.byteOffset, der.byteOffset + der.byteLength));
      if (asn.offset === -1) throw new Error('bad ASN.1');
      signedData = new pkijs.SignedData({ schema: new pkijs.ContentInfo({ schema: asn.result }).content });
    } catch (e) {
      return { status: 'invalid', reason: 'The signature container could not be read.', sha256 };
    }

    const signed = new Uint8Array(b + d);
    signed.set(bytes.subarray(0, b), 0);
    signed.set(bytes.subarray(c, c + d), b);

    let verified = false;
    let signerCert = null;
    let detail = '';
    try {
      const r = await signedData.verify({ signer: 0, data: signed.buffer, checkChain: false, extendedMode: true }, cryptoEngine);
      verified = !!r.signatureVerified;
      signerCert = r.signerCertificate || null;
      if (!verified) detail = String(r.message || '');
    } catch (e) { verified = false; detail = String((e && e.message) || e); }
    if (!verified) return { status: 'invalid', reason: 'The signature does not match the document — it was changed after signing, or the signature is fake.', detail, sha256 };

    const trailing = text.slice(c + d);
    const wholeFile = /^\s*$/.test(trailing);

    let signedAt = null;
    try {
      const attrs = signedData.signerInfos[0].signedAttrs?.attributes || [];
      const t = attrs.find((x) => x.type === OID.signingTime);
      if (t) signedAt = new Date(t.values[0].toDate()).toISOString();
    } catch (e) { /* optional */ }

    last = { signedData, signerCert, wholeFile, signedAt };
  }

  const { signedData, signerCert, wholeFile, signedAt } = last;
  const signer = signerCert ? nameOf(signerCert.subject) : {};
  const issuer = signerCert ? nameOf(signerCert.issuer) : {};
  const base = { sha256, signer, issuer, signedAt, wholeFile };

  if (!wholeFile) return { ...base, status: 'modified', reason: 'The file was changed after it was signed (extra content was added at the end).' };

  if (!trustedRootsPem.length) return { ...base, status: 'untrusted', reason: 'The signature is genuine, but no approved government certificates are configured yet to confirm who signed it.' };
  try {
    const roots = trustedRootsPem.map((p) => pkijs.Certificate.fromBER(pemToDer(p)));
    const bag = [...(signedData.certificates || [])].filter((c) => c instanceof pkijs.Certificate);
    const engine = new pkijs.CertificateChainValidationEngine({ certs: bag, trustedCerts: roots, checkDate: signedAt ? new Date(signedAt) : new Date() });
    const res = await engine.verify({}, cryptoEngine);
    if (res.result) return { ...base, status: 'authentic', reason: 'Digitally signed by an approved authority; the document is unaltered.' };
    return { ...base, status: 'untrusted', reason: 'The signature is genuine, but the signer is not an approved government authority.' };
  } catch (e) {
    return { ...base, status: 'untrusted', reason: 'The signer\'s certificate chain could not be confirmed.' };
  }
}
