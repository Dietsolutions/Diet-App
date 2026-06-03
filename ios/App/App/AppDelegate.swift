import UIKit
import Capacitor
import AuthenticationServices

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {

    var window: UIWindow?
    private var pendingAppleCompletion: ((Result<AppleSignInResult, Error>) -> Void)?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) { }

    func applicationDidEnterBackground(_ application: UIApplication) { }

    func applicationWillEnterForeground(_ application: UIApplication) { }

    func applicationDidBecomeActive(_ application: UIApplication) { }

    func applicationWillTerminate(_ application: UIApplication) { }

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
    // Public entry point used by the JS bridge (postMessage from the WebView).
    @objc func startAppleSignIn() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            let provider = ASAuthorizationAppleIDProvider()
            let request  = provider.createRequest()
            request.requestedScopes = [.fullName, .email]
            // Optionally accept a nonce from the JS layer for replay protection
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
        guard let json = try? JSONSerialization.data(withJSONObject: payload, options: []) else { return }
        let jsonString = String(data: json, encoding: .utf8) ?? "{}"
        let escaped = jsonString
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
            .replacingOccurrences(of: "\n", with: "\\n")
        let js = "window.dispatchEvent(new CustomEvent('\(name)', { detail: JSON.parse(\"\(escaped)\") }));"
        DispatchQueue.main.async {
            // Post to the active Capacitor WebView
            if let bridge = (UIApplication.shared.delegate as? AppDelegate)?.window?.rootViewController as? CAPBridgeViewController {
                bridge.bridge?.webView?.evaluateJavaScript(js, completionHandler: nil)
            }
            // Fallback: broadcast via NotificationCenter for any other listeners
            NotificationCenter.default.post(name: Notification.Name(name), object: nil, userInfo: payload)
        }
    }

    // ── ASAuthorizationControllerPresentationContextProviding ──────────────
    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        if let window = self.window { return window }
        return ASPresentationAnchor()
    }
}

// Result struct for Swift interop (not used directly — JS reads via NotificationCenter event)
struct AppleSignInResult {
    let identityToken: String
    let fullName: [String: String]?
    let email: String?
    let user: String
}
