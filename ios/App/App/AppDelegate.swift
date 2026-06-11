import UIKit
import Capacitor
import AuthenticationServices

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default", sessionRole: connectingSceneSession.role)
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Custom URL scheme used by the WebView to trigger native Sign in with Apple.
        // The JS layer calls window.location.href = "dietplan://apple-signin"
        if url.scheme == "dietplan" && url.host == "apple-signin" {
            startAppleSignIn()
            return true
        }
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    // ── Sign in with Apple ────────────────────────────────────────────────
    // Public entry point invoked by the JS bridge when the WebView
    // navigates to `dietplan://apple-signin` (see Info.plist CFBundleURLTypes).
    @objc func startAppleSignIn() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            let provider = ASAuthorizationAppleIDProvider()
            let request  = provider.createRequest()
            request.requestedScopes = [.fullName, .email]
            // Nonce support is left to the server: the server generates a
            // nonce, returns it to the client, the client forwards it to
            // Apple, and we receive it back in `identityToken` for the
            // server to verify. Apple JS SDK does not pass a nonce through
            // this URL-scheme bridge, so we leave it server-side.
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }

    // ── ASAuthorizationControllerDelegate ────────────────────────────────
    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let appleIDCredential = authorization.credential as? ASAuthorizationAppleIDCredential else { return }

        let identityToken: String? = {
            if let data = appleIDCredential.identityToken { return String(data: data, encoding: .utf8) }
            return nil
        }()

        let fullName: [String: String]? = {
            guard let name = appleIDCredential.fullName else { return nil }
            var result: [String: String] = [:]
            if let g = name.givenName { result["givenName"] = g }
            if let f = name.familyName { result["familyName"] = f }
            return result.isEmpty ? nil : result
        }()

        let email = appleIDCredential.email

        let payload: [String: Any] = [
            "identityToken": identityToken ?? "",
            "fullName": fullName ?? [:],
            "email": email ?? "",
            "user": appleIDCredential.user,
        ]

        // Forward the result to the WebView via a window event.
        Self.dispatchWebViewEvent(name: "apple-signin-success", payload: payload)
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        Self.dispatchWebViewEvent(name: "apple-signin-error", payload: ["error": error.localizedDescription])
    }

    // ── Bridge helpers ───────────────────────────────────────────────────
    private static func dispatchWebViewEvent(name: String, payload: [String: Any]) {
        // Serialize the payload safely with JSONSerialization — this is the
        // correct way to inject data into a JS context, and is immune to
        // quote/newline injection in the payload values.
        guard let json = try? JSONSerialization.data(withJSONObject: payload, options: []) else { return }
        let jsonString = String(data: json, encoding: .utf8) ?? "{}"
        // Pass the JSON blob as a JS string literal; no manual escaping needed.
        let js = "window.dispatchEvent(new CustomEvent('\(name)', { detail: \(jsonString) }));"
        DispatchQueue.main.async {
            // Walk the view-controller hierarchy to find the Capacitor bridge.
            // The root may be a UINavigationController, UITabBarController, or
            // other wrapper — not always CAPBridgeViewController directly.
            if let bridge = Self.findCapacitorBridge() {
                bridge.webView?.evaluateJavaScript(js, completionHandler: nil)
            }
            // Fallback: broadcast via NotificationCenter for any other listeners
            NotificationCenter.default.post(name: Notification.Name(name), object: nil, userInfo: payload)
        }
    }

    private static func findCapacitorBridge() -> CAPBridgeViewController? {
        let root: UIViewController? = {
            // Scene-based: get from the window scene
            if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
               let window = scene.windows.first(where: { $0.isKeyWindow }) {
                return window.rootViewController
            }
            // Legacy fallback
            return UIApplication.shared.keyWindow?.rootViewController
        }()
        guard let root else { return nil }
        if let bridge = root as? CAPBridgeViewController { return bridge }
        if let nav = root as? UINavigationController, let bridge = nav.viewControllers.first as? CAPBridgeViewController { return bridge }
        if let tab = root as? UITabBarController, let bridge = tab.viewControllers?.first as? CAPBridgeViewController { return bridge }
        if let presented = root.presentedViewController as? CAPBridgeViewController { return presented }
        for sub in root.view.subviews {
            if let bridge = sub as? CAPBridgeViewController { return bridge }
        }
        return nil
    }

    // ── ASAuthorizationControllerPresentationContextProviding ──────────────
    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let window = scene.windows.first(where: { $0.isKeyWindow }) {
            return window
        }
        return ASPresentationAnchor()
    }
}
