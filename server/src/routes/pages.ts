import { Router, Request, Response } from 'express';

const router = Router();

const RESET_PASSWORD_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reset Password - Diet Plan & Tracker</title>
<style>
*{box-sizing:border-box}
body{font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:400px;margin:0 auto;padding:24px 16px;color:#333;line-height:1.5;font-size:15px;background:#f5f5f7}
h1{font-size:20px;margin-bottom:4px;font-weight:600}
p{color:#666;font-size:14px;margin-bottom:20px}
label{display:block;font-size:12px;font-weight:600;color:#555;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em}
input{width:100%;padding:10px 12px;border:1px solid #ccc;border-radius:6px;font-size:15px;margin-bottom:14px;outline:none}
input:focus{border-color:#F97316;box-shadow:0 0 0 2px rgba(249,115,22,0.2)}
button{width:100%;padding:12px;background:#F97316;color:#fff;border:none;border-radius:6px;font-size:15px;font-weight:600;cursor:pointer}
button:disabled{opacity:0.6}
button.secondary{background:transparent;color:#666;border:1px solid #ccc;margin-top:8px}
.error{color:#d32f2f;font-size:13px;margin-bottom:12px;padding:10px;background:#ffebee;border-radius:6px;display:none}
.success{color:#2e7d32;font-size:14px;margin-bottom:12px;padding:14px;background:#e8f5e9;border-radius:6px;text-align:center}
.hidden{display:none}
.spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;display:inline-block;vertical-align:middle;margin-right:6px}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div id="app">
  <h1>Reset Password</h1>
  <div id="loading">Validating your reset link...</div>
</div>
<script>
(async function(){
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const app = document.getElementById('app');

  if (!token) {
    app.innerHTML = '<h1>Invalid Link</h1><div class="error" style="display:block">This password reset link is missing a token. Please request a new one.</div>';
    return;
  }

  // Validate token
  try {
    const check = await fetch('/api/auth/check-reset-token?token=' + encodeURIComponent(token));
    const data = await check.json();
    if (!data.valid) {
      app.innerHTML = '<h1>Link Expired</h1><div class="error" style="display:block">This password reset link has expired or has already been used. Please request a new one.</div>';
      return;
    }
  } catch {
    app.innerHTML = '<h1>Connection Error</h1><div class="error" style="display:block">Could not connect to the server. Please try again later.</div>';
    return;
  }

  app.innerHTML = \`
    <h1>Reset Password</h1>
    <p>Enter your new password below.</p>
    <div id="error" class="error"></div>
    <div id="success" class="success hidden"></div>
    <form id="resetForm">
      <label for="password">New Password</label>
      <input id="password" type="password" minlength="6" required autocomplete="new-password" placeholder="At least 6 characters" />
      <label for="confirm">Confirm Password</label>
      <input id="confirm" type="password" minlength="6" required autocomplete="new-password" placeholder="Re-enter your password" />
      <button type="submit" id="submitBtn">Reset Password</button>
    </form>
  \`;

  document.getElementById('resetForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirm').value;
    const error = document.getElementById('error');
    const success = document.getElementById('success');
    const btn = document.getElementById('submitBtn');

    if (password !== confirm) {
      error.textContent = 'Passwords do not match.';
      error.style.display = 'block';
      return;
    }
    if (password.length < 6) {
      error.textContent = 'Password must be at least 6 characters.';
      error.style.display = 'block';
      return;
    }

    error.style.display = 'none';
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Resetting...';

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (data.success) {
        app.innerHTML = \`
          <h1>Password Reset</h1>
          <div class="success" style="display:block">Your password has been reset successfully.</div>
          <p style="text-align:center">You can now log in with your new password.</p>
          <a href="/" style="display:block;text-align:center;color:#F97316;text-decoration:none;font-weight:600;margin-top:8px">Go to App</a>
        \`;
      } else {
        error.textContent = data.error || 'Failed to reset password.';
        error.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Reset Password';
      }
    } catch {
      error.textContent = 'Connection error. Please try again.';
      error.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Reset Password';
    }
  });
})();
</script>
</body>
</html>`;

const PRIVACY_POLICY = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Privacy Policy - Diet Plan & Tracker</title>
<style>
body{font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:720px;margin:0 auto;padding:24px 16px;color:#333;line-height:1.6;font-size:15px}
h1{font-size:22px;margin-bottom:4px}
h2{font-size:17px;margin-top:28px;margin-bottom:8px}
p{margin:0 0 12px}
.updated{color:#888;font-size:13px;margin-bottom:20px}
</style></head>
<body>
<h1>Privacy Policy</h1>
<p class="updated">Last updated: June 3, 2026</p>

<h2>Information We Collect</h2>
<p><strong>Account Information.</strong> When you register, we collect your username and a securely hashed password. If you sign in with Google, we receive your name, email address, and Google account ID.</p>
<p><strong>Profile Information.</strong> To generate personalised meal plans, we collect weight, height, age, gender, activity level, dietary preferences, cuisine preferences, allergies, health conditions, fitness goals, eating window, and cooking style.</p>
<p><strong>Usage Data.</strong> We log meal selections, food swaps, water intake, weight history, shopping list items, and meal logging activity to provide the core app experience.</p>
<p><strong>Device Information.</strong> We collect device type, operating system version, and app version for analytics and crash reporting.</p>

<h2>How We Use Your Information</h2>
<p>We use your information to: (a) generate personalised AI meal plans; (b) track your nutrition and fitness progress; (c) improve and optimise the app; (d) send password reset emails if requested; (e) comply with legal obligations. We never sell your personal data to third parties.</p>

<h2>AI Meal Plan Generation</h2>
<p>When you generate a meal plan, your profile data (weight, height, dietary preferences, allergies, health conditions, goals) is sent to third-party LLM providers (OpenAI via Microsoft Azure and/or Anthropic) solely for the purpose of generating your personalised meal plan. These providers are contractually prohibited from using your data for model training or improvement. Data is transmitted encrypted in transit and is not retained by these providers beyond the duration of the API request.</p>

<h2>Data Sharing &amp; Third-Party Services</h2>
<p>We use the following service providers to operate the app. Each provider is contractually bound to process data only for the purposes we specify:</p>
<p><strong>Neon (PostgreSQL)</strong> — database hosting. Data is stored encrypted at rest in ISO 27001-certified data centres.<br>
<strong>Vercel Inc.</strong> — application hosting and serverless functions.<br>
<strong>OpenAI / Anthropic</strong> — AI meal plan generation (see AI section above).<br>
<strong>CalorieNinjas</strong> — nutritional data validation of generated meals.<br>
<strong>PostHog Inc.</strong> — product analytics. Data is anonymised (internal user IDs only, no PII). You can disable analytics tracking at any time from Profile settings.<br>
<strong>Google LLC</strong> — optional Google Sign-In authentication.</p>

<h2>Data Retention &amp; Deletion</h2>
<p>We retain your data for as long as your account remains active. When you delete your account (available in Profile settings), all associated data is permanently deleted from our servers and third-party services within 30 days. Residual copies may remain in backup systems for up to 90 days before complete purging.</p>

<h2>Your Rights</h2>
<p>You have the right to: (a) access a copy of your personal data; (b) correct inaccurate data; (c) delete your account and associated data; (d) object to or restrict processing; (e) data portability. To exercise these rights, use the Profile settings in the app or contact us using the information below.</p>

<h2>Children's Privacy</h2>
<p>The app is not intended for children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal data, contact us and we will delete it.</p>

<h2>International Data Transfers</h2>
<p>Your data may be processed in the United States, India, the European Union, or other countries where our service providers operate. We ensure appropriate safeguards (Standard Contractual Clauses, Data Processing Agreements) are in place for cross-border data transfers.</p>

<h2>Security</h2>
<p>We implement industry-standard security measures: encryption in transit (TLS 1.3), encryption at rest, hashed passwords (bcrypt, 12 rounds), and regular security audits. No security measure is 100% effective; we cannot guarantee absolute security.</p>

<h2>Changes to This Policy</h2>
<p>We may update this policy. Material changes will be notified via the app or by email. Continued use after changes constitutes acceptance of the updated policy.</p>

<h2>Contact</h2>
<p>For privacy inquiries or data requests, contact: support@dietplan.app or through the App Store / Play Store listing.</p>

<h2>Governing Law</h2>
<p>This policy is governed by the laws of India. For users in the European Union, the General Data Protection Regulation (GDPR) also applies.</p>
</body></html>`;

const TERMS_OF_SERVICE = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Terms of Service - Diet Plan & Tracker</title>
<style>
body{font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:720px;margin:0 auto;padding:24px 16px;color:#333;line-height:1.6;font-size:15px}
h1{font-size:22px;margin-bottom:4px}
h2{font-size:17px;margin-top:28px;margin-bottom:8px}
p{margin:0 0 12px}
.updated{color:#888;font-size:13px;margin-bottom:20px}
</style></head>
<body>
<h1>Terms of Service</h1>
<p class="updated">Last updated: June 3, 2026</p>

<h2>Acceptance of Terms</h2>
<p>By downloading, installing, or using Diet Plan & Tracker ("the App"), you agree to these Terms of Service. If you do not agree, do not use the App.</p>

<h2>Medical Disclaimer</h2>
<p><strong>Diet Plan & Tracker provides AI-generated meal plans, nutritional tracking, and dietary suggestions for informational and educational purposes only. The App is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider (physician, registered dietitian, or nutritionist) before starting any diet, exercise, or nutrition program, especially if you have or suspect you have a medical condition. Never disregard professional medical advice or delay in seeking it because of content from this App. If you have a medical emergency, call your doctor or emergency services immediately.</strong></p>
<p>The App does not provide medical care, and no practitioner-patient relationship is created by your use of the App. Generated meal plans are algorithmic suggestions, not personalised medical prescriptions.</p>

<h2>AI-Generated Content Disclaimer</h2>
<p>Meal plans in this App are generated by artificial intelligence (large language models). While we strive for accuracy, AI-generated content may contain errors, omissions, or inappropriate suggestions. You are solely responsible for reviewing and verifying that any meal plan is appropriate for your specific health conditions, allergies, dietary requirements, and cultural preferences. The developers are not responsible for adverse effects resulting from reliance on AI-generated content.</p>

<h2>Service Description</h2>
<p>The App uses artificial intelligence to generate personalised meal plans based on your stated goals, preferences, dietary restrictions, and profile information. The App also provides food tracking, nutritional logging, water intake tracking, weight tracking, and shopping list features. Features may change over time.</p>

<h2>Account Registration</h2>
<p>You must be at least 13 years old to use the App. You agree to: (a) provide accurate, current, and complete information; (b) maintain the confidentiality of your login credentials; (c) notify us immediately of any unauthorised use; (d) be responsible for all activity under your account. You may delete your account at any time from Profile settings.</p>

<h2>User Responsibilities</h2>
<p>You agree to: (a) use the App only for lawful purposes; (b) not attempt to circumvent rate limits or security measures; (c) not use the App to generate harmful, abusive, or inappropriate content; (d) not reverse-engineer, copy, or redistribute the App; (e) not use the App in any way that could damage, disable, or impair our services.</p>

<h2>Intellectual Property</h2>
<p>The App, including its code, design, logos, and branding, is owned by the developer and protected by applicable intellectual property laws. You are granted a non-exclusive, non-transferable, revocable licence to use the App for personal, non-commercial purposes. Generated meal plans are provided for your personal use only.</p>

<h2>Limitation of Liability</h2>
<p>To the maximum extent permitted by law, the App is provided "as is" without warranties of any kind, express or implied. The developers, affiliates, and service providers shall not be liable for any direct, indirect, incidental, special, consequential, or exemplary damages arising from or relating to your use of the App, including but not limited to health complications, allergic reactions, weight changes, or data loss. Your sole remedy is to discontinue use of the App.</p>

<h2>Termination</h2>
<p>We may suspend or terminate your access to the App at any time, with or without cause, with or without notice. Upon termination, your right to use the App ceases immediately. Provisions regarding limitation of liability, governing law, and dispute resolution survive termination.</p>

<h2>Changes to Terms</h2>
<p>We may update these terms at any time. Material changes will be notified via the App or by email. Continued use after changes constitutes acceptance of the updated terms.</p>

<h2>Governing Law &amp; Dispute Resolution</h2>
<p>These terms are governed by the laws of India. Any disputes arising from these terms shall be resolved through binding arbitration in accordance with the Arbitration and Conciliation Act, 1996. The arbitration shall be conducted in English in Mumbai, India. You agree to resolve disputes on an individual basis and waive the right to participate in a class action.</p>

<h2>Contact</h2>
<p>For questions about these terms, contact: support@dietplan.app or through the App Store / Play Store listing.</p>
</body></html>`;

router.get('/reset-password', (_req: Request, res: Response) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(RESET_PASSWORD_PAGE);
});

const FORGOT_PASSWORD_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Forgot Password - Diet Plan & Tracker</title>
<style>
*{box-sizing:border-box}
body{font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:400px;margin:0 auto;padding:24px 16px;color:#333;line-height:1.5;font-size:15px;background:#f5f5f7}
h1{font-size:20px;margin-bottom:4px;font-weight:600}
p{color:#666;font-size:14px;margin-bottom:20px}
label{display:block;font-size:12px;font-weight:600;color:#555;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em}
input{width:100%;padding:10px 12px;border:1px solid #ccc;border-radius:6px;font-size:15px;margin-bottom:14px;outline:none}
input:focus{border-color:#F97316;box-shadow:0 0 0 2px rgba(249,115,22,0.2)}
button{width:100%;padding:12px;background:#F97316;color:#fff;border:none;border-radius:6px;font-size:15px;font-weight:600;cursor:pointer}
button:disabled{opacity:0.6}
button.secondary{background:transparent;color:#666;border:1px solid #ccc;margin-top:8px}
.error{color:#d32f2f;font-size:13px;margin-bottom:12px;padding:10px;background:#ffebee;border-radius:6px;display:none}
.success{color:#2e7d32;font-size:14px;margin-bottom:12px;padding:14px;background:#e8f5e9;border-radius:6px;text-align:center;display:none}
.spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;display:inline-block;vertical-align:middle;margin-right:6px}
@keyframes spin{to{transform:rotate(360deg)}}
a.link{color:#F97316;text-decoration:none;font-weight:600}
</style>
</head>
<body>
<h1>Forgot Password</h1>
<p>Enter the email address on your account and we'll send you a link to reset your password.</p>
<div id="error" class="error"></div>
<div id="success" class="success"></div>
<form id="forgotForm">
  <label for="email">Email</label>
  <input id="email" type="email" required autocomplete="email" placeholder="you@example.com" />
  <button type="submit" id="submitBtn">Send Reset Link</button>
  <button type="button" class="secondary" onclick="window.location.href='/'">Back to App</button>
</form>
<script>
document.getElementById('forgotForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const error = document.getElementById('error');
  const success = document.getElementById('success');
  const btn = document.getElementById('submitBtn');

  if (!email) {
    error.textContent = 'Please enter your email address.';
    error.style.display = 'block';
    return;
  }

  error.style.display = 'none';
  success.style.display = 'none';
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Sending...';

  try {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (res.ok) {
      success.textContent = 'If that email is on file, a reset link is on its way. Check your inbox.';
      success.style.display = 'block';
      btn.style.display = 'none';
      document.getElementById('email').disabled = true;
    } else {
      error.textContent = data.error || 'Could not send reset email. Please try again later.';
      error.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Send Reset Link';
    }
  } catch {
    error.textContent = 'Connection error. Please try again.';
    error.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Send Reset Link';
  }
});
</script>
</body>
</html>`;

router.get('/forgot-password', (_req: Request, res: Response) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(FORGOT_PASSWORD_PAGE);
});

router.get('/privacy', (_req: Request, res: Response) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(PRIVACY_POLICY);
});

router.get('/terms', (_req: Request, res: Response) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(TERMS_OF_SERVICE);
});

export default router;
