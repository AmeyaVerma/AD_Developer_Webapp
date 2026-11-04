# Mahabhulekh fill-in helper (Chrome / Edge)

Fills the 7/12 form on https://bhulekh.mahabhumi.gov.in from the AD Developers app so the agent only has to type the
**captcha** and press **Submit**. It never reads or solves the captcha and never submits anything.

## Install (once per computer)
1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and choose this `extension` folder.

## Use
In the app, open a property's Title Search and click **Fetch original (auto-fill)**. Mahabhulekh opens in a new tab with
district, taluka, village and your mobile number filled in. A small box tells you what is left: the Gat, the captcha, Submit.

## Notes
- Your mobile number comes from your profile (the Admin adds it in Settings). It travels in the part of the address after
  `#`, which is never sent to any server; the helper removes it from the address bar immediately.
- It does not work in Chrome on a phone (phones cannot run extensions). On a phone, use the copy buttons in the app.
- If the site changes its form, the helper may need an update.
