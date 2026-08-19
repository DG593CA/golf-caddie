import SwiftUI
import RevenueCat

@MainActor
public class SubscriptionManager: ObservableObject {
    public static let shared = SubscriptionManager()
    
    @Published public var isPremium: Bool = false
    @Published public var customerInfo: CustomerInfo?
    @Published public var offerings: Offerings?
    @Published public var isLoading: Bool = false
    @Published public var purchaseError: String?
    
    private init() {
        Purchases.shared.delegate = self
        Task {
            await fetchCustomerInfo()
            await fetchOfferings()
        }
    }
    
    /// Pulls the latest subscription state from RevenueCat servers
    public func fetchCustomerInfo() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let info = try await Purchases.shared.customerInfo()
            self.customerInfo = info
            self.updatePremiumStatus(with: info)
        } catch {
            print("❌ RevenueCat: Failed to fetch CustomerInfo: \(error.localizedDescription)")
        }
    }
    
    /// Pulls active products/packages offerings
    public func fetchOfferings() async {
        do {
            let fetchedOfferings = try await Purchases.shared.offerings()
            self.offerings = fetchedOfferings
        } catch {
            print("❌ RevenueCat: Failed to fetch offerings: \(error.localizedDescription)")
        }
    }
    
    /// Purchases a package (monthly, yearly, or lifetime)
    public func purchase(package: Package) async -> Bool {
        isLoading = true
        purchaseError = nil
        defer { isLoading = false }
        
        do {
            let result = try await Purchases.shared.purchase(package: package)
            self.customerInfo = result.customerInfo
            self.updatePremiumStatus(with: result.customerInfo)
            return !result.userCancelled
        } catch {
            self.purchaseError = error.localizedDescription
            print("❌ RevenueCat: Purchase failed: \(error.localizedDescription)")
            return false
        }
    }
    
    /// Restores historical purchases
    public func restorePurchases() async {
        isLoading = true
        purchaseError = nil
        defer { isLoading = false }
        
        do {
            let info = try await Purchases.shared.restorePurchases()
            self.customerInfo = info
            self.updatePremiumStatus(with: info)
        } catch {
            self.purchaseError = error.localizedDescription
            print("❌ RevenueCat: Restore failed: \(error.localizedDescription)")
        }
    }
    
    /// Helper to update local premium status using entitlement IDs
    private func updatePremiumStatus(with info: CustomerInfo) {
        // Entitlement ID configured in your RevenueCat Dashboard
        self.isPremium = info.entitlements.active["GolfCaddieAi Pro"] != nil
    }
}

// MARK: - PurchasesDelegate
extension SubscriptionManager: PurchasesDelegate {
    public func purchases(_ purchases: Purchases, receivedUpdated customerInfo: CustomerInfo) {
        Task { @MainActor in
            self.customerInfo = customerInfo
            self.updatePremiumStatus(with: customerInfo)
            print("🔔 RevenueCat: Entitlements updated. Active status: \(self.isPremium)")
        }
    }
}
