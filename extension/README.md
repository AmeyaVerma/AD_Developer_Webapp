# Mahabhulekh fill-in helper (Chrome / Edge)

Fills the 7/12 form on https://bhulekh.mahabhumi.gov.in from the AD Developers app so the agent only has to type the
**captcha** and press **Submit**. It never reads or solves the captcha and never submits anything.

## Install (once per computer)
1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and choose this `extension` folder.

## Use
In the app, open a property's Title Search and click **Fetch original (auto-fill)**. Mahabhulekh opens in a new tab with
district, taluka, village, Gat and your mobile number filled in. The helper picks the Gat from the site's own list of the village's Gat numbers, and if the 7/12 is unclear about the Marathi letter (e.g. 1/ग/42 or 1/य/42) it shows the options instead of guessing. A small box tells you what is left: usually just the captcha and Submit.

## Notes
- Your mobile number comes from your profile (the Admin adds it in Settings). It travels in the part of the address after
  `#`, which is never sent to any server; the helper removes it from the address bar immediately.
- It does not work in Chrome on a phone (phones cannot run extensions). On a phone, use the copy buttons in the app.
- If the site changes its form, the helper may need an update.
