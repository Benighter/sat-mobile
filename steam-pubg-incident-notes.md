# Steam / PUBG Incident Notes

All times are local machine time, Africa/Johannesburg.

## Key Timeline

- 2026-07-03 15:16:45: Steam launched PUBG (`AppID 578080`) from `E:\SteamLibrary\steamapps\common\PUBG\...`.
- 2026-07-03 15:21:09: Steam overlay opened an in-game purchase approval page:
  - `https://checkout.steampowered.com/checkout/approvetxn/100915697974519620/?returnurl=steam`
- 2026-07-03 15:21:24: Steam overlay opened Steam Wallet add-funds page for the same microtransaction:
  - `microtxn=100915697974519620`
- 2026-07-03 15:21:29: Steam overlay opened checkout for:
  - `cart=579423158392258682`
  - `microtxn=100915697974519620`
- 2026-07-03 15:22:58: Steam overlay returned to the purchase approval page.
- 2026-07-03 15:23:03: Steam overlay closed the authorization window (`steam://close/authorize`).
- 2026-07-06 22:35:10: Steam Support "account stolen" page was opened.
- 2026-07-06 22:45:25: Steam Support item-purchase page was opened for PUBG and `transid=100915697974519620`.
- 2026-07-06 22:47:14: Steam history recorded "You have successfully added funds to your Steam Wallet":
  - receipt `100915697974519804`
- 2026-07-06 22:47:43: Steam Support in-game purchase page was opened for:
  - `transid=100915697974519620`
  - `appid=578080`
- 2026-07-06 22:47:54: Steam receipt page was opened for:
  - `100915697974487779`
  - page title was `Site Error`
- 2026-07-06 22:48:09: Steam Support PUBG ban page was opened:
  - "I've been VAC banned or in-game banned"
- 2026-07-06 22:49:33: Steam Authorized Devices page was opened.
- 2026-07-06 22:49:38: Steam password reset/change flow was opened.
- 2026-07-08 23:28:15: Steam sign-in window opened.
- 2026-07-08 23:29:12 and 23:30:20: Steam login failures occurred.
- 2026-07-08 23:31:30: Steam login succeeded.

## Local Security Checks Performed

- Microsoft Defender quick scan completed on 2026-07-09 00:49:08.
- No new Defender detections appeared from that quick scan.
- Defender real-time protection, behavior monitoring, IOAV, antivirus, and antispyware were enabled when checked.
- Older Defender detections existed from late June:
  - `H:\Adobe Acrobat\crack.exe`
  - `F:\Far Cry 4\bin\uplay_r164.dll`
  - `F:\Far Cry 4\bin\steam_api.dll`
  - `F:\Far Cry 4\bin\steam_api64.dll`
- Startup items looked mostly normal: Windows Security, Realtek, OneDrive, HP utility, Notion, Copilot, Ant Download Manager.
- Custom scheduled tasks found:
  - `DownloadsMonitorTask`
  - `Fix External Drive Letters`
  - `Launch SanDisk Unlocker on plug-in`
  - `MSIAfterburner`
  - `ZoomUpdateTask...`
  - `OneDrive Startup Task...`

## Browser / Steam History Findings

- Chrome history around 2026-07-03 14:45-16:00 did not show an obvious third-party PUBG rank selling site.
- Steam embedded browser history did show the PUBG purchase / Steam Wallet checkout flow.
- Steam embedded browser history on 2026-07-06 shows account recovery, authorized devices, password reset, purchase support, and PUBG ban support pages.

## Support Message Draft

Hello,

I believe my Steam account and PUBG account were compromised. I am requesting a review of the PUBG ban / purchase issue and the related Steam transactions.

I did not intentionally request a refund/chargeback related to this PUBG account issue. Around the same period, Steam Support indicated my Steam account security may have been compromised and reset the account password.

Relevant local timeline from my Steam logs:

- 2026-07-03 15:16 local time: PUBG was launched through Steam.
- 2026-07-03 15:21 local time: Steam overlay opened a PUBG in-game purchase approval page for microtransaction `100915697974519620`.
- 2026-07-03 15:21 local time: Steam Wallet / checkout pages opened for the same microtransaction.
- 2026-07-06 22:45 local time: I opened Steam Support for the PUBG in-game purchase `100915697974519620`.
- 2026-07-06 22:47 local time: Steam history shows receipt `100915697974519804`.
- 2026-07-06 22:48 local time: I opened Steam Support pages for PUBG ban / gameplay issue.
- 2026-07-06 22:49 local time: I opened Steam Authorized Devices and password reset pages.
- 2026-07-08 23:31 local time: Steam login succeeded after Steam Support reset the account.

Please review whether this ban/purchase/refund issue is related to account compromise or unauthorized activity. I can provide screenshots or additional account ownership proof if needed.

Thank you.

## Immediate Next Steps

- From Steam Account Details, open Authorized Devices and use "Sign out everywhere" if not already done.
- Change the email account password tied to Steam and enable 2FA there.
- Confirm Steam Guard Mobile Authenticator is enabled.
- Review Steam purchase history and wallet history for the transaction IDs above.
- Review bank/card/PayPal history for any chargebacks or disputed payments around 2026-07-03 to 2026-07-06.
- Remove pirated/cracked software and old game cracks; these are high risk for credential theft.
- Run Microsoft Defender Offline Scan from Windows Security if you want a stronger malware check.
