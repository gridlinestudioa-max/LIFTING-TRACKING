# Email templates

Branded, professional versions of the emails Supabase sends. To use them:

1. In Supabase, open **Authentication → Emails** (called **Email Templates** in some versions).
2. For each template below, set the **Subject**, then replace the **Message body** with the whole file's contents.
3. Save.

| Supabase template   | Subject                                   | File                  |
| ------------------- | ----------------------------------------- | --------------------- |
| Confirm signup      | Confirm your email for Training Tracker   | `confirm-signup.html` |
| Reset password      | Reset your Training Tracker password      | `reset-password.html` |
| Magic link          | Your Training Tracker sign-in link        | `magic-link.html`     |
| Change email address| Confirm your new email for Training Tracker | `change-email.html` |

Keep `{{ .ConfirmationURL }}`, `{{ .Email }}` and `{{ .NewEmail }}` as they are: Supabase fills them in.

**App name and logo:** the name is written in each file ("Training Tracker"), and the logo is a dark square with a "T".
To use an image logo, follow the comment near the top of each file (the image must be on a public https address,
for example your website's `/logo.png`).

**Sender name and address:** Supabase's built-in email service sends from a Supabase address, is limited to a few
emails an hour, and is meant for testing. For real users, set up **Authentication → Emails → SMTP Settings** with an
email provider (for example Resend, Postmark or Amazon SES) so emails come from your own domain, such as
"Training Tracker <hello@yourdomain.com>".

**Where the links open:** the app asks for links to open the website they were requested from, and opening one
signs the person in (a confirmation link shows "You're signed in"; a reset link asks for a new password).
For that to work, add your site under **Authentication → URL Configuration**:
- **Site URL**: your live address, e.g. `https://your-site.vercel.app`
- **Redirect URLs**: the same address plus `/**`, and `https://*-gridlinestudioa-max.vercel.app/**` for preview builds.
