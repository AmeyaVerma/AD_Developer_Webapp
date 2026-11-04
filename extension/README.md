# Mahabhulekh helper (Chrome / Edge)

Fills the 7/12 form on https://bhulekh.mahabhumi.gov.in from the AD Developers app, and sends the record back to the app.
You only type the **captcha** and press **Submit**. It never reads or solves the captcha and never submits anything itself.

## Install (once per computer)
1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose this `extension` folder.
4. After an update, click the circular **Reload** arrow on the extension's card.

## Use
1. In the app, open a property's Title Search and click **Fetch original (auto-fill)**.
2. A small window opens on Mahabhulekh with district, taluka, village, Gat and your mobile number filled in. The Gat is picked
   from the site's own list; if the 7/12 is unclear about the Marathi letter (e.g. 1/ग/42 or 1/य/42) the options are shown instead.
3. Type the captcha and press **Submit**.
4. When the record shows, click the green **Send this record to AD Developers** button. Chrome briefly shows a
   "debugging this browser" bar (that is how an extension prints a page to PDF). The window closes and the record
   appears in the app under ORIGINAL SATBARA DOC by itself, ready to download with the property's name.

## Notes
- Your mobile number comes from your profile (the Admin adds it in Settings). The details travel in the part of the address
  after `#`, which is never sent to any server; the helper removes it from the address bar immediately.
- The upload link is one-time, for one document, and expires after 2 hours.
- Not available in Chrome on a phone (phones cannot run extensions). On a phone, use the copy buttons in the app.
- If the site changes its form, the helper may need an update.
