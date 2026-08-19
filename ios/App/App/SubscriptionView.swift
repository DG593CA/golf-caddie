import SwiftUI
import RevenueCat
import RevenueCatUI

struct SubscriptionView: View {
    @StateObject private var subManager = SubscriptionManager.shared
    @State private var isShowingCustomerCenter = false
    @State private var isShowingPaywall = false

    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                // Header status
                VStack(spacing: 8) {
                    Text(subManager.isPremium ? "⭐ PRO MEMBER" : "FREE PLAN")
                        .font(.headline)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 6)
                        .background(subManager.isPremium ? Color.green.opacity(0.15) : Color.gray.opacity(0.15))
                        .foregroundColor(subManager.isPremium ? .green : .gray)
                        .cornerRadius(12)
                    
                    Text("GolfCaddieAi Assistant")
                        .font(.title2)
                        .fontWeight(.bold)
                }
                .padding(.top)

                Divider()

                if subManager.isLoading {
                    ProgressView("Retrieving subscription data...")
                        .frame(maxHeight: .infinity)
                } else {
                    ScrollView {
                        VStack(spacing: 16) {
                            // Demo check for features
                            if subManager.isPremium {
                                premiumFeaturesDashboard
                            } else {
                                lockOverlayDashboard
                            }

                            // Render Offerings
                            if let offerings = subManager.offerings,
                               let currentOffering = offerings.current {
                                
                                Text("Select a Caddie Pro Plan")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                                    .padding(.top)
                                
                                ForEach(currentOffering.availablePackages) { pkg in
                                    packageRow(for: pkg)
                                }
                            } else {
                                Text("No subscription plans currently loaded from configuration.")
                                    .font(.footnote)
                                    .foregroundColor(.secondary)
                                    .multilineTextAlignment(.center)
                                    .padding()
                            }
                        }
                        .padding()
                    }
                }

                Spacer()

                // Bottom actions: Restore & Customer Center
                VStack(spacing: 10) {
                    Button(action: {
                        Task {
                            await subManager.restorePurchases()
                        }
                    }) {
                        Text("Restore Purchases")
                            .font(.footnote)
                            .foregroundColor(.accentColor)
                    }

                    if subManager.isPremium {
                        Button(action: {
                            isShowingCustomerCenter = true
                        }) {
                            Text("Manage Subscription (Customer Center)")
                                .font(.footnote)
                                .fontWeight(.semibold)
                                .foregroundColor(.secondary)
                        }
                    }
                }
                .padding(.bottom)
            }
            .navigationTitle("Caddie Subscriptions")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $isShowingCustomerCenter) {
                // Present Customer Center natively to manage/cancel plans
                CustomerCenterView()
            }
            // MODIFIER: Present official dashboard paywall modally if needed
            .sheet(isPresented: $isShowingPaywall) {
                PaywallView()
            }
        }
    }

    // MARK: - Premium Features Dashboard
    private var premiumFeaturesDashboard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("🔓 Pro Features Unlocked!")
                .font(.headline)
                .foregroundColor(.green)
            
            Text("• Unlimited Live GPS Distances\n• Speech and Voice Command Scoring\n• AI Coach Drills & Analytics Reports")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color.green.opacity(0.05))
        .cornerRadius(8)
    }

    // MARK: - Locked State Info
    private var lockOverlayDashboard: some View {
        VStack(spacing: 12) {
            Text("🔒 Pro Features Locked")
                .font(.headline)
                .foregroundColor(.amber)
            
            Button("View Pre-built Paywall UI") {
                isShowingPaywall = true
            }
            .font(.subheadline)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(Color.accentColor)
            .foregroundColor(.white)
            .cornerRadius(8)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color.yellow.opacity(0.05))
        .cornerRadius(8)
    }

    // MARK: - Package UI Row
    private func packageRow(for pkg: Package) -> some View {
        Button(action: {
            Task {
                let success = await subManager.purchase(package: pkg)
                if success {
                    print("✅ Subscription purchased successfully!")
                }
            }
        }) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(packageName(for: pkg))
                        .font(.headline)
                        .foregroundColor(.primary)
                    Text(pkg.storeProduct.localizedDescription)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.leading)
                }
                Spacer()
                Text(pkg.localizedPriceString)
                    .font(.subheadline)
                    .fontWeight(.bold)
                    .foregroundColor(.accentColor)
            }
            .padding()
            .background(RoundedRectangle(cornerRadius: 10).stroke(Color.gray.opacity(0.3), lineWidth: 1))
        }
    }

    private func packageName(for pkg: Package) -> String {
        switch pkg.packageType {
        case .monthly: return "Monthly Subscription"
        case .annual: return "Yearly Subscription"
        case .lifetime: return "Lifetime Premium Pass"
        default: return pkg.storeProduct.localizedTitle
        }
    }
}

// Helper color extension for warnings
extension Color {
    static let amber = Color(red: 217/255, green: 119/255, blue: 6/255)
}
