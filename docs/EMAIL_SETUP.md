# Email setup for birthday notifications

This project uses a Firebase Callable Function with SendGrid to send birthday emails.

Setup steps:

1. Create a SendGrid account and verify a sender (from address). Recommended: `no-reply@sat-mobile.app` or your own domain.
2. Get an API key with Mail Send permission.
3. In the `functions/` folder, set the secret once:

		 - Windows PowerShell

			 ```powershell
			 firebase functions:secrets:set SENDGRID_API_KEY
			 ```

4. Deploy functions:

		```powershell
		firebase deploy --only functions
		```

Notes

- The callable function name is `sendBirthdayEmail`.
- The admin UI "Send Test Email" calls this function and sends to the signed-in user's email only.
- You can change the default `from` address in `functions/index.js`.

Troubleshooting

- If you get 403 Forbidden from SendGrid, verify the sender identity in SendGrid dashboard.
- After changing the secret value, redeploy functions.
- In the local emulator, you can use a `.secret.local` override.
