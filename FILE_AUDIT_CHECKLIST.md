# 파일 전수 감사 체크리스트 (2026-07-03 생성)

총 651개 소스 파일(테스트 제외). 클러스터 완료 시 [x] + 발견은 CODE_AUDIT_2026-07-03.md 에 기록.

## [ ] lib-기타 (109)
- [ ] lib/admin-audit.ts
- [ ] lib/allergy-sku-matrix.ts
- [ ] lib/analysis/narrative.ts
- [ ] lib/analytics.ts
- [ ] lib/anthropic-models.ts
- [ ] lib/anthropic-usage.ts
- [ ] lib/api/errors-body.ts
- [ ] lib/api/errors.ts
- [ ] lib/api/parseRequest-body.ts
- [ ] lib/api/parseRequest.ts
- [ ] lib/api/schemas.ts
- [ ] lib/app-context.ts
- [ ] lib/autosignup-draft.ts
- [ ] lib/breeds/breed-names.ts
- [ ] lib/breeds/cluster.ts
- [ ] lib/breeds/registry.ts
- [ ] lib/business.ts
- [ ] lib/capacitor.ts
- [ ] lib/chat/proactive-nudges.ts
- [ ] lib/chatbot-system-prompt.ts
- [ ] lib/chronic-sku-mapper.ts
- [ ] lib/commentary.ts
- [ ] lib/commerce/addresses.ts
- [ ] lib/commerce/order-fsm.ts
- [ ] lib/commerce/points.ts
- [ ] lib/commerce/refund-recovery.ts
- [ ] lib/consent.ts
- [ ] lib/cookies.ts
- [ ] lib/copy-strings.ts
- [ ] lib/counterfactual.ts
- [ ] lib/cron-auth.ts
- [ ] lib/cron-tracking.ts
- [ ] lib/csv.ts
- [ ] lib/dashboard/milestones.ts
- [ ] lib/dashboard/next-action.ts
- [ ] lib/dashboard/streaks.ts
- [ ] lib/dateStamp.ts
- [ ] lib/datetime-kst.ts
- [ ] lib/design/contrast.ts
- [ ] lib/design/tokens.ts
- [ ] lib/diet-simulation.ts
- [ ] lib/discount.ts
- [ ] lib/dog-records.ts
- [ ] lib/dogPhotos.ts
- [ ] lib/env.ts
- [ ] lib/featureFlags.ts
- [ ] lib/feeding-outcomes.ts
- [ ] lib/feeding-plan.ts
- [ ] lib/feeding/auto-intake.ts
- [ ] lib/formatters.ts
- [ ] lib/forms/zod-ko.ts
- [ ] lib/haptic.ts
- [ ] lib/imageDownscale.ts
- [ ] lib/integrations/tractive.ts
- [ ] lib/intervention-window.ts
- [ ] lib/invention-flags.ts
- [ ] lib/korean.ts
- [ ] lib/log-sanitize.ts
- [ ] lib/markdown.ts
- [ ] lib/medications/registry.ts
- [ ] lib/meta-learning/exploration.ts
- [ ] lib/meta-learning/intervention-windows.ts
- [ ] lib/meta-learning/message-decomposition.ts
- [ ] lib/mix-feeding.ts
- [ ] lib/motion.ts
- [ ] lib/nrc-38-nutrients.ts
- [ ] lib/nutrients-spec.ts
- [ ] lib/nutrition.ts
- [ ] lib/nutrition/ai-prompt.ts
- [ ] lib/nutrition/confidence-interval.ts
- [ ] lib/nutrition/drugs.ts
- [ ] lib/nutrition/guidelines.ts
- [ ] lib/nutrition/risk-flags.ts
- [ ] lib/onboarding.ts
- [ ] lib/onboarding/grace-period.ts
- [ ] lib/payment-events.ts
- [ ] lib/payment-reconcile.ts
- [ ] lib/persona.ts
- [ ] lib/products/stock.ts
- [ ] lib/products/variants.ts
- [ ] lib/push.ts
- [ ] lib/push/native.ts
- [ ] lib/rate-limit.ts
- [ ] lib/raw-ca-p-calculator.ts
- [ ] lib/rewards/cap.ts
- [ ] lib/rewards/measurement-upgrade.ts
- [ ] lib/sentry/alerts.ts
- [ ] lib/sentry/trace.ts
- [ ] lib/seo/jsonld.ts
- [ ] lib/sku-nutrition-matrix.ts
- [ ] lib/sku-size-matcher.ts
- [ ] lib/start-plan.ts
- [ ] lib/start-teaser.ts
- [ ] lib/storage/medical-records.ts
- [ ] lib/storage/progress-photos.ts
- [ ] lib/swr-lite.ts
- [ ] lib/theme.ts
- [ ] lib/tiers.ts
- [ ] lib/tracking.ts
- [ ] lib/ui-flags.ts
- [ ] lib/ui/blur.ts
- [ ] lib/ui/cn.ts
- [ ] lib/ui/useModalA11y.ts
- [ ] lib/utm.ts
- [ ] lib/v3-helpers/analysis-view.ts
- [ ] lib/v3-helpers/subscriptions.ts
- [ ] lib/vision/parseMedicalRecord.ts
- [ ] lib/vision/w-image.ts
- [ ] lib/web-recipes.ts

## [ ] app-웹마케팅·기타 (71)
- [ ] app/about/page.tsx
- [ ] app/app-required/page.tsx
- [ ] app/auth/callback/route.ts
- [ ] app/best/page.tsx
- [ ] app/blog/[slug]/page.tsx
- [ ] app/blog/loading.tsx
- [ ] app/blog/page.tsx
- [ ] app/brand/layout.tsx
- [ ] app/brand/loading.tsx
- [ ] app/brand/page.tsx
- [ ] app/business/page.tsx
- [ ] app/cart/loading.tsx
- [ ] app/cart/page.tsx
- [ ] app/collections/[slug]/page.tsx
- [ ] app/collections/layout.tsx
- [ ] app/collections/page.tsx
- [ ] app/compare/CompareClient.tsx
- [ ] app/compare/page.tsx
- [ ] app/contact/ContactForm.tsx
- [ ] app/contact/page.tsx
- [ ] app/error.tsx
- [ ] app/events/[slug]/page.tsx
- [ ] app/events/page.tsx
- [ ] app/faq/layout.tsx
- [ ] app/faq/page.tsx
- [ ] app/global-error.tsx
- [ ] app/layout.tsx
- [ ] app/legal/page.tsx
- [ ] app/legal/privacy/page.tsx
- [ ] app/legal/refund/page.tsx
- [ ] app/legal/terms/page.tsx
- [ ] app/newsletter/NewsletterForm.tsx
- [ ] app/newsletter/layout.tsx
- [ ] app/newsletter/page.tsx
- [ ] app/not-found.tsx
- [ ] app/offline/page.tsx
- [ ] app/onboarding/age-gate/page.tsx
- [ ] app/opengraph-image.tsx
- [ ] app/our-food/page.tsx
- [ ] app/page.tsx
- [ ] app/partners/layout.tsx
- [ ] app/partners/page.tsx
- [ ] app/photo-upload/[token]/PhotoUploadClient.tsx
- [ ] app/photo-upload/[token]/page.tsx
- [ ] app/plans/page.tsx
- [ ] app/products/[slug]/page.tsx
- [ ] app/products/layout.tsx
- [ ] app/products/page.tsx
- [ ] app/reviews/page.tsx
- [ ] app/robots.ts
- [ ] app/science/layout.tsx
- [ ] app/science/page.tsx
- [ ] app/sitemap.ts
- [ ] app/start/StartClient.tsx
- [ ] app/start/StartSurvey.tsx
- [ ] app/start/claim/page.tsx
- [ ] app/start/done/page.tsx
- [ ] app/start/layout.tsx
- [ ] app/start/page.tsx
- [ ] app/start/survey/page.tsx
- [ ] app/tools/elimination-diet/EliminationDietClient.tsx
- [ ] app/tools/elimination-diet/page.tsx
- [ ] app/tools/raw-calculator/RawCalculatorClient.tsx
- [ ] app/tools/raw-calculator/page.tsx
- [ ] app/unsubscribed/page.tsx
- [ ] app/vet/[token]/VetSharePrintButton.tsx
- [ ] app/vet/[token]/page.tsx
- [ ] app/welcome/layout.tsx
- [ ] app/welcome/page.tsx
- [ ] app/why-app/page.tsx
- [ ] app/why-fresh/page.tsx

## [ ] app/admin (67)
- [ ] app/admin/algorithm/AlgorithmConfigClient.tsx
- [ ] app/admin/algorithm/page.tsx
- [ ] app/admin/beta-cohort/BetaCohortPrintButton.tsx
- [ ] app/admin/beta-cohort/page.tsx
- [ ] app/admin/blog/BlogPostForm.tsx
- [ ] app/admin/blog/[id]/page.tsx
- [ ] app/admin/blog/categories/CategoriesManager.tsx
- [ ] app/admin/blog/categories/page.tsx
- [ ] app/admin/blog/new/page.tsx
- [ ] app/admin/blog/page.tsx
- [ ] app/admin/cohort/CohortCharts.tsx
- [ ] app/admin/cohort/page.tsx
- [ ] app/admin/cron-health/page.tsx
- [ ] app/admin/cs-inbox/page.tsx
- [ ] app/admin/error.tsx
- [ ] app/admin/events/AdminEventsClient.tsx
- [ ] app/admin/events/page.tsx
- [ ] app/admin/faqs/AdminFaqsClient.tsx
- [ ] app/admin/faqs/page.tsx
- [ ] app/admin/feature-flags/FeatureFlagsClient.tsx
- [ ] app/admin/feature-flags/page.tsx
- [ ] app/admin/finance/page.tsx
- [ ] app/admin/funnel/page.tsx
- [ ] app/admin/invention-flags/page.tsx
- [ ] app/admin/label/[sku]/LabelPrintButton.tsx
- [ ] app/admin/label/[sku]/page.tsx
- [ ] app/admin/layout.tsx
- [ ] app/admin/orders/[id]/OrderStatusControl.tsx
- [ ] app/admin/orders/[id]/PartialCancelPanel.tsx
- [ ] app/admin/orders/[id]/PaymentEventTimeline.tsx
- [ ] app/admin/orders/[id]/ShippingControl.tsx
- [ ] app/admin/orders/[id]/page.tsx
- [ ] app/admin/orders/page.tsx
- [ ] app/admin/page.tsx
- [ ] app/admin/partners/AdminPartnersClient.tsx
- [ ] app/admin/partners/page.tsx
- [ ] app/admin/personalization-insights/page.tsx
- [ ] app/admin/personalization/SimulatorClient.tsx
- [ ] app/admin/personalization/V3SimulatorClient.tsx
- [ ] app/admin/personalization/page.tsx
- [ ] app/admin/personalization/picking-list/PickingListExport.tsx
- [ ] app/admin/personalization/picking-list/page.tsx
- [ ] app/admin/products/ProductForm.tsx
- [ ] app/admin/products/ProductRowActions.tsx
- [ ] app/admin/products/[id]/insights/page.tsx
- [ ] app/admin/products/[id]/nutrients/NutrientsForm.tsx
- [ ] app/admin/products/[id]/nutrients/actions.ts
- [ ] app/admin/products/[id]/nutrients/page.tsx
- [ ] app/admin/products/[id]/page.tsx
- [ ] app/admin/products/new/page.tsx
- [ ] app/admin/products/page.tsx
- [ ] app/admin/push-campaigns/CampaignBuilder.tsx
- [ ] app/admin/push-campaigns/page.tsx
- [ ] app/admin/push-stats/page.tsx
- [ ] app/admin/qna/AdminQnaClient.tsx
- [ ] app/admin/qna/page.tsx
- [ ] app/admin/refunds/page.tsx
- [ ] app/admin/reports/PrintButtonClient.tsx
- [ ] app/admin/reports/page.tsx
- [ ] app/admin/search-all/page.tsx
- [ ] app/admin/search/page.tsx
- [ ] app/admin/subscriptions/calendar/page.tsx
- [ ] app/admin/subscriptions/charges/page.tsx
- [ ] app/admin/subscriptions/page.tsx
- [ ] app/admin/users/[id]/message/MessageComposer.tsx
- [ ] app/admin/users/[id]/message/page.tsx
- [ ] app/admin/users/page.tsx

## [ ] app/(main)/dogs (64)
- [ ] app/(main)/dogs/[id]/DogDetailClient.tsx
- [ ] app/(main)/dogs/[id]/_components/CurrentFormulaCard.tsx
- [ ] app/(main)/dogs/[id]/_components/SubscriptionCard.tsx
- [ ] app/(main)/dogs/[id]/_components/WeightSparkline.tsx
- [ ] app/(main)/dogs/[id]/_components/types.ts
- [ ] app/(main)/dogs/[id]/analyses/[analysisId]/page.tsx
- [ ] app/(main)/dogs/[id]/analyses/page.tsx
- [ ] app/(main)/dogs/[id]/analysis/AnalysisView.tsx
- [ ] app/(main)/dogs/[id]/analysis/_components/AnalysisArchiveBanner.tsx
- [ ] app/(main)/dogs/[id]/analysis/_components/AnalysisCTASection.tsx
- [ ] app/(main)/dogs/[id]/analysis/_components/AnalysisEmptyState.tsx
- [ ] app/(main)/dogs/[id]/analysis/_components/AnalysisMagazineSection.tsx
- [ ] app/(main)/dogs/[id]/analysis/_components/AnalysisStickySummary.tsx
- [ ] app/(main)/dogs/[id]/analysis/layout.tsx
- [ ] app/(main)/dogs/[id]/analysis/loading.tsx
- [ ] app/(main)/dogs/[id]/analysis/page.tsx
- [ ] app/(main)/dogs/[id]/approve/ApproveClient.tsx
- [ ] app/(main)/dogs/[id]/approve/page.tsx
- [ ] app/(main)/dogs/[id]/checkin/CheckinClient.tsx
- [ ] app/(main)/dogs/[id]/checkin/page.tsx
- [ ] app/(main)/dogs/[id]/diary/DiaryClient.tsx
- [ ] app/(main)/dogs/[id]/diary/page.tsx
- [ ] app/(main)/dogs/[id]/edit/EditDogClient.tsx
- [ ] app/(main)/dogs/[id]/edit/page.tsx
- [ ] app/(main)/dogs/[id]/first-checkin/FirstCheckinClient.tsx
- [ ] app/(main)/dogs/[id]/first-checkin/page.tsx
- [ ] app/(main)/dogs/[id]/formulas/page.tsx
- [ ] app/(main)/dogs/[id]/health/HealthLogClient.tsx
- [ ] app/(main)/dogs/[id]/health/page.tsx
- [ ] app/(main)/dogs/[id]/layout.tsx
- [ ] app/(main)/dogs/[id]/loading.tsx
- [ ] app/(main)/dogs/[id]/medications/MedicationsClient.tsx
- [ ] app/(main)/dogs/[id]/medications/page.tsx
- [ ] app/(main)/dogs/[id]/order/OrderClient.tsx
- [ ] app/(main)/dogs/[id]/order/page.tsx
- [ ] app/(main)/dogs/[id]/page.tsx
- [ ] app/(main)/dogs/[id]/photos/PhotosClient.tsx
- [ ] app/(main)/dogs/[id]/photos/page.tsx
- [ ] app/(main)/dogs/[id]/reminders/RemindersClient.tsx
- [ ] app/(main)/dogs/[id]/reminders/page.tsx
- [ ] app/(main)/dogs/[id]/survey/SurveyClient.tsx
- [ ] app/(main)/dogs/[id]/survey/loading.tsx
- [ ] app/(main)/dogs/[id]/survey/page.tsx
- [ ] app/(main)/dogs/[id]/survey/steps/Allergy.tsx
- [ ] app/(main)/dogs/[id]/survey/steps/Body.tsx
- [ ] app/(main)/dogs/[id]/survey/steps/Budget.tsx
- [ ] app/(main)/dogs/[id]/survey/steps/Diet.tsx
- [ ] app/(main)/dogs/[id]/survey/steps/Loading.tsx
- [ ] app/(main)/dogs/[id]/survey/steps/Muscle.tsx
- [ ] app/(main)/dogs/[id]/survey/steps/Preferences.tsx
- [ ] app/(main)/dogs/[id]/survey/steps/Pregnancy.tsx
- [ ] app/(main)/dogs/[id]/survey/steps/Status.tsx
- [ ] app/(main)/dogs/[id]/survey/steps/Stool.tsx
- [ ] app/(main)/dogs/[id]/vaccinations/VaccinationsClient.tsx
- [ ] app/(main)/dogs/[id]/vaccinations/page.tsx
- [ ] app/(main)/dogs/[id]/vet-report/ShareWithVetButton.tsx
- [ ] app/(main)/dogs/[id]/vet-report/VetReportPrintButton.tsx
- [ ] app/(main)/dogs/[id]/vet-report/page.tsx
- [ ] app/(main)/dogs/[id]/year-in-review/page.tsx
- [ ] app/(main)/dogs/compare/page.tsx
- [ ] app/(main)/dogs/loading.tsx
- [ ] app/(main)/dogs/new/NewDogClient.tsx
- [ ] app/(main)/dogs/new/page.tsx
- [ ] app/(main)/dogs/page.tsx

## [x] components-공용 (60) — 웨이브2 완료(실버그0, stale주석 수정)
- [ ] components/AddressSearch.tsx
- [ ] components/AnalyticsScripts.tsx
- [ ] components/AppChrome.tsx
- [ ] components/AppContextCookieSync.tsx
- [ ] components/AppleLoginButton.tsx
- [ ] components/AuthAwareShell.tsx
- [ ] components/ConsentBootstrap.tsx
- [ ] components/ConsentLevelCard.tsx
- [ ] components/CookieConsent.tsx
- [ ] components/CookieConsentResetLink.tsx
- [ ] components/DevContextToggle.tsx
- [ ] components/DogFamilyMembers.tsx
- [ ] components/DogPawMark.tsx
- [ ] components/DogPhotoPicker.tsx
- [ ] components/InstallPrompt.tsx
- [ ] components/JsonLd.tsx
- [ ] components/KakaoLoginButton.tsx
- [ ] components/LegalDocument.tsx
- [ ] components/MedicalRecordForm.tsx
- [ ] components/MedicalRecordOcr.tsx
- [ ] components/Onboarding.tsx
- [ ] components/OnboardingGate.tsx
- [ ] components/PhotoFrameGuide.tsx
- [ ] components/PhotoRequestButton.tsx
- [ ] components/SentryUserSync.tsx
- [ ] components/ServiceWorkerRegister.tsx
- [ ] components/ShareButton.tsx
- [ ] components/SiteFooter.tsx
- [ ] components/ThemeToggle.tsx
- [ ] components/UtmCapture.tsx
- [ ] components/VetShareButton.tsx
- [ ] components/WebChrome.tsx
- [ ] components/WebVitalsReporter.tsx
- [ ] components/account/LogoutButton.tsx
- [ ] components/account/PasswordChangeButton.tsx
- [ ] components/account/ProfileForm.tsx
- [ ] components/account/TierBadge.tsx
- [ ] components/admin/ActionsPanel.tsx
- [ ] components/admin/AdminNav.tsx
- [ ] components/admin/AdminPagination.tsx
- [ ] components/admin/CategoryRevenueDonut.tsx
- [ ] components/admin/CohortLtvTable.tsx
- [ ] components/admin/CohortRetentionTable.tsx
- [ ] components/admin/FoodInfoCompletion.tsx
- [ ] components/admin/OrderRealtimeBell.tsx
- [ ] components/admin/RevenueChart.tsx
- [ ] components/admin/ui.tsx
- [ ] components/auth/AuthHero.tsx
- [ ] components/dashboard/AccuracyBreakdown.tsx
- [ ] components/dashboard/OnboardingTutorial.tsx
- [ ] components/dog/InterventionWindowCard.tsx
- [ ] components/dogs/DogTabsNav.tsx
- [ ] components/landing/Reveal.tsx
- [ ] components/ui/BottomSheet.tsx
- [ ] components/ui/Button.tsx
- [ ] components/ui/CopyButton.tsx
- [ ] components/ui/ErrorScreen.tsx
- [ ] components/ui/Skeleton.tsx
- [ ] components/ui/Spinner.tsx
- [ ] components/ui/Toast.tsx

## [x] components/v3 (36) — 웨이브1 완료(에이전트, 실버그0)
- [ ] components/v3/AllergyBanner.tsx
- [ ] components/v3/Avatar.tsx
- [ ] components/v3/Badge.tsx
- [ ] components/v3/BrandLoader.tsx
- [ ] components/v3/Cropper.tsx
- [ ] components/v3/DatePicker.tsx
- [ ] components/v3/Mark.tsx
- [ ] components/v3/Modal.tsx
- [ ] components/v3/Mono.tsx
- [ ] components/v3/PawFab.tsx
- [ ] components/v3/Select.tsx
- [ ] components/v3/Signature.tsx
- [ ] components/v3/Skeleton.tsx
- [ ] components/v3/Slider.tsx
- [ ] components/v3/Sparkline.tsx
- [ ] components/v3/StreakRewards.tsx
- [ ] components/v3/Tabs.tsx
- [ ] components/v3/Toggle.tsx
- [ ] components/v3/dog/WeightInputSheet.tsx
- [ ] components/v3/home/ActiveDogCard.tsx
- [ ] components/v3/home/DeliveryStripCard.tsx
- [ ] components/v3/home/EmptyHomeNoDogs.tsx
- [ ] components/v3/home/GreetingSection.tsx
- [ ] components/v3/home/JournalSection.tsx
- [ ] components/v3/home/MyDogsSection.tsx
- [ ] components/v3/home/QuickActionChips.tsx
- [ ] components/v3/home/ThisWeekSection.tsx
- [ ] components/v3/home/index.ts
- [ ] components/v3/index.ts
- [ ] components/v3/sheet/QuickChipSheet.tsx
- [ ] components/v3/sheet/QuickHealthSheet.tsx
- [ ] components/v3/sheet/QuickMemoSheet.tsx
- [ ] components/v3/sheet/QuickPhotoSheet.tsx
- [ ] components/v3/sheet/QuickWalkSheet.tsx
- [ ] components/v3/sheet/QuickWeightSheet.tsx
- [ ] components/v3/useConfirm.tsx

## [ ] app/(main)/mypage (33)
- [ ] app/(main)/mypage/MypageClient.tsx
- [ ] app/(main)/mypage/accuracy/page.tsx
- [ ] app/(main)/mypage/addresses/AddressForm.tsx
- [ ] app/(main)/mypage/addresses/AddressesClient.tsx
- [ ] app/(main)/mypage/addresses/[id]/edit/page.tsx
- [ ] app/(main)/mypage/addresses/new/page.tsx
- [ ] app/(main)/mypage/addresses/page.tsx
- [ ] app/(main)/mypage/certificate/[dogId]/CertificateClient.tsx
- [ ] app/(main)/mypage/certificate/[dogId]/page.tsx
- [ ] app/(main)/mypage/consent/ConsentSettingsClient.tsx
- [ ] app/(main)/mypage/consent/page.tsx
- [ ] app/(main)/mypage/cs/CsThreadClient.tsx
- [ ] app/(main)/mypage/cs/page.tsx
- [ ] app/(main)/mypage/delete/DeleteAccountForm.tsx
- [ ] app/(main)/mypage/delete/page.tsx
- [ ] app/(main)/mypage/integrations/IntegrationDisconnectButton.tsx
- [ ] app/(main)/mypage/integrations/page.tsx
- [ ] app/(main)/mypage/loading.tsx
- [ ] app/(main)/mypage/membership/page.tsx
- [ ] app/(main)/mypage/notifications/NotificationSettingsClient.tsx
- [ ] app/(main)/mypage/notifications/PreferencesPanel.tsx
- [ ] app/(main)/mypage/notifications/page.tsx
- [ ] app/(main)/mypage/page.tsx
- [ ] app/(main)/mypage/points/PointsBrowser.tsx
- [ ] app/(main)/mypage/points/page.tsx
- [ ] app/(main)/mypage/privacy/page.tsx
- [ ] app/(main)/mypage/reviews/page.tsx
- [ ] app/(main)/mypage/subscriptions/SubscriptionsClient.tsx
- [ ] app/(main)/mypage/subscriptions/_components/SubscriptionCancelModal.tsx
- [ ] app/(main)/mypage/subscriptions/_components/SubscriptionCard.tsx
- [ ] app/(main)/mypage/subscriptions/_components/SubscriptionsEmptyState.tsx
- [ ] app/(main)/mypage/subscriptions/_components/SubscriptionsNewBanner.tsx
- [ ] app/(main)/mypage/subscriptions/page.tsx

## [ ] app/api/cron (28)
- [ ] app/api/cron/account-purge/route.ts
- [ ] app/api/cron/dcm-screening-reminder/route.ts
- [ ] app/api/cron/dog-age-update/route.ts
- [ ] app/api/cron/first-box-checkin/route.ts
- [ ] app/api/cron/intervention-alerts/route.ts
- [ ] app/api/cron/inventory-forecast/route.ts
- [ ] app/api/cron/meta-weights/route.ts
- [ ] app/api/cron/onboarding-funnel/route.ts
- [ ] app/api/cron/ops-digest/route.ts
- [ ] app/api/cron/order-expire/route.ts
- [ ] app/api/cron/payment-ledger-reconcile/route.ts
- [ ] app/api/cron/personalization-approval-timeout/route.ts
- [ ] app/api/cron/personalization-progression/route.ts
- [ ] app/api/cron/protein-rotation/route.ts
- [ ] app/api/cron/push-lifecycle/route.ts
- [ ] app/api/cron/quality-check-reminder/route.ts
- [ ] app/api/cron/quarterly-report/route.ts
- [ ] app/api/cron/reanalysis-reminder-6m/route.ts
- [ ] app/api/cron/reanalyze-trigger/route.ts
- [ ] app/api/cron/refund-retry/route.ts
- [ ] app/api/cron/review-prompts/route.ts
- [ ] app/api/cron/sensitivity-snapshots/route.ts
- [ ] app/api/cron/subscription-charge/route.ts
- [ ] app/api/cron/subscription-cleanup/route.ts
- [ ] app/api/cron/subscription-reminders/route.ts
- [ ] app/api/cron/tracking-poll/route.ts
- [ ] app/api/cron/weight-change-detect/route.ts
- [ ] app/api/cron/weight-reminder/route.ts

## [ ] app-웹계정·결제화면 (26)
- [ ] app/account/dogs/page.tsx
- [ ] app/account/page.tsx
- [ ] app/account/profile/page.tsx
- [ ] app/account/subscriptions/SubscriptionsWebClient.tsx
- [ ] app/account/subscriptions/page.tsx
- [ ] app/checkout/error.tsx
- [ ] app/checkout/fail/page.tsx
- [ ] app/checkout/loading.tsx
- [ ] app/checkout/page.tsx
- [ ] app/checkout/success/PurchaseTracker.tsx
- [ ] app/checkout/success/loading.tsx
- [ ] app/checkout/success/page.tsx
- [ ] app/mypage/orders/OrdersAppView.tsx
- [ ] app/mypage/orders/[id]/CancelOrderButton.tsx
- [ ] app/mypage/orders/[id]/page.tsx
- [ ] app/mypage/orders/[id]/receipt/ReceiptAutoPrint.tsx
- [ ] app/mypage/orders/[id]/receipt/page.tsx
- [ ] app/mypage/orders/[id]/review/[itemId]/ReviewForm.tsx
- [ ] app/mypage/orders/[id]/review/[itemId]/page.tsx
- [ ] app/mypage/orders/[id]/track/TrackingView.tsx
- [ ] app/mypage/orders/[id]/track/page.tsx
- [ ] app/mypage/orders/loading.tsx
- [ ] app/mypage/orders/page.tsx
- [ ] app/subscribe/billing-auth/page.tsx
- [ ] app/subscribe/billing-fail/page.tsx
- [ ] app/subscribe/billing-success/page.tsx

## [x] lib/personalization (22) — 웨이브1 완료(에이전트, 실버그0)
- [ ] lib/personalization/diff.ts
- [ ] lib/personalization/firstBox.ts
- [ ] lib/personalization/format.ts
- [ ] lib/personalization/formulaCache.ts
- [ ] lib/personalization/lines.ts
- [ ] lib/personalization/method-lock.ts
- [ ] lib/personalization/nextBox.ts
- [ ] lib/personalization/nutrientPanel.ts
- [ ] lib/personalization/quantize.ts
- [ ] lib/personalization/reanalyze-triggers.ts
- [ ] lib/personalization/reliability.ts
- [ ] lib/personalization/skuMap.ts
- [ ] lib/personalization/skuModel.ts
- [ ] lib/personalization/transfers.ts
- [ ] lib/personalization/types.ts
- [ ] lib/personalization/v3/catalog.ts
- [ ] lib/personalization/v3/config.ts
- [ ] lib/personalization/v3/engine.ts
- [ ] lib/personalization/v3/feedback.ts
- [ ] lib/personalization/v3/integrate.ts
- [ ] lib/personalization/v3/profile.ts
- [ ] lib/personalization/v3/types.ts

## [ ] app/(main)-기타 (20)
- [ ] app/(main)/chat/ChatClient.tsx
- [ ] app/(main)/chat/page.tsx
- [ ] app/(main)/dashboard/loading.tsx
- [ ] app/(main)/dashboard/page.tsx
- [ ] app/(main)/error.tsx
- [ ] app/(main)/family/page.tsx
- [ ] app/(main)/invitations/[token]/InviteAccept.tsx
- [ ] app/(main)/invitations/[token]/page.tsx
- [ ] app/(main)/invitations/new/NewInviteClient.tsx
- [ ] app/(main)/invitations/new/page.tsx
- [ ] app/(main)/layout.tsx
- [ ] app/(main)/loading.tsx
- [ ] app/(main)/notifications/NotificationsClient.tsx
- [ ] app/(main)/notifications/page.tsx
- [ ] app/(main)/reports/ReportExportButton.tsx
- [ ] app/(main)/reports/page.tsx
- [ ] app/(main)/search/page.tsx
- [ ] app/(main)/subscribe/[slug]/SubscribeClient.tsx
- [ ] app/(main)/subscribe/[slug]/page.tsx
- [ ] app/(main)/template.tsx

## [ ] components/analysis (14)
- [ ] components/analysis/AdjustSheet.tsx
- [ ] components/analysis/AnalysisTrendsCard.tsx
- [ ] components/analysis/PriceFramingCard.tsx
- [ ] components/analysis/RecommendationBox.tsx
- [ ] components/analysis/magazine/BoxMixCard.tsx
- [ ] components/analysis/magazine/CTAStack.tsx
- [ ] components/analysis/magazine/DailyEnergyCard.tsx
- [ ] components/analysis/magazine/DiagnosisCard.tsx
- [ ] components/analysis/magazine/HeroSection.tsx
- [ ] components/analysis/magazine/NutrientsCard.tsx
- [ ] components/analysis/magazine/ReportCard.tsx
- [ ] components/analysis/magazine/SupplementsCard.tsx
- [ ] components/analysis/magazine/palette.ts
- [ ] components/analysis/magazine/primitives.tsx

## [x] lib/email (13) — 웨이브1 완료(에이전트, 실버그0)
- [ ] lib/email/client.ts
- [ ] lib/email/escape.ts
- [ ] lib/email/index.ts
- [ ] lib/email/layout.ts
- [ ] lib/email/templates/dog-invitation.ts
- [ ] lib/email/templates/newsletter-vol-01.ts
- [ ] lib/email/templates/newsletter-welcome.ts
- [ ] lib/email/templates/newsletter.ts
- [ ] lib/email/templates/orders.ts
- [ ] lib/email/templates/personalization-cycle.ts
- [ ] lib/email/templates/quarterly-report.ts
- [ ] lib/email/templates/subscription.ts
- [ ] lib/email/unsubscribe-token.ts

## [x] CORE-인증·supabase (11) — 웨이브2 완료(실버그0)
- [ ] app/(auth)/forgot-password/page.tsx
- [ ] app/(auth)/layout.tsx
- [ ] app/(auth)/login/page.tsx
- [ ] app/(auth)/reset-password/page.tsx
- [ ] lib/auth/admin.ts
- [ ] lib/auth/applyAutosignupDraft.ts
- [ ] lib/auth/applySignupProfile.ts
- [ ] lib/supabase/admin.ts
- [ ] lib/supabase/client.ts
- [ ] lib/supabase/server.ts
- [ ] lib/supabase/types.ts

## [ ] app/api/admin (10)
- [ ] app/api/admin/blog/draft/route.ts
- [ ] app/api/admin/blog/upload/route.ts
- [ ] app/api/admin/events/upload/route.ts
- [ ] app/api/admin/orders/[id]/partial-cancel/route.ts
- [ ] app/api/admin/orders/[id]/status/route.ts
- [ ] app/api/admin/orders/export/route.ts
- [ ] app/api/admin/products/[id]/duplicate/route.ts
- [ ] app/api/admin/products/upload/route.ts
- [ ] app/api/admin/push-campaigns/route.ts
- [ ] app/api/admin/users/[id]/message/route.ts

## [ ] components/web (7)
- [ ] components/web/fd/AppShowcase.tsx
- [ ] components/web/fd/BreedCombobox.tsx
- [ ] components/web/fd/FdFooter.tsx
- [ ] components/web/fd/FdRecipeSheet.tsx
- [ ] components/web/fd/FdSlider.tsx
- [ ] components/web/fd/StickyCta.tsx
- [ ] components/web/fd/ui.tsx

## [x] app/api/dogs (5) — 웨이브2 완료
- [ ] app/api/dogs/[id]/invite/route.ts
- [ ] app/api/dogs/[id]/measurement-upgrade/route.ts
- [ ] app/api/dogs/[id]/photo-request/route.ts
- [ ] app/api/dogs/[id]/progress-photos/route.ts
- [ ] app/api/dogs/[id]/vet-share/route.ts

## [x] CORE-결제 (5) — 직접 정독 완료(실버그0, stale주석2 수정)
- [ ] app/api/payments/billing-issue/route.ts
- [ ] app/api/payments/confirm/route.ts
- [ ] app/api/payments/webhook/route.ts
- [ ] lib/payments/billing-error-classify.ts
- [ ] lib/payments/toss.ts

## [x] app/api/push (5) — 웨이브2 완료
- [ ] app/api/push/native-register/route.ts
- [ ] app/api/push/preferences/route.ts
- [ ] app/api/push/subscribe/route.ts
- [ ] app/api/push/test/route.ts
- [ ] app/api/push/unsubscribe/route.ts

## [ ] app/api/personalization (4)
- [ ] app/api/personalization/adjust/route.ts
- [ ] app/api/personalization/approve/route.ts
- [ ] app/api/personalization/checkin/route.ts
- [ ] app/api/personalization/compute/route.ts

## [ ] app/api/addresses (3)
- [ ] app/api/addresses/[id]/default/route.ts
- [ ] app/api/addresses/[id]/route.ts
- [ ] app/api/addresses/route.ts

## [ ] app/api/chatbot (3)
- [ ] app/api/chatbot/nudge/route.ts
- [ ] app/api/chatbot/route.ts
- [ ] app/api/chatbot/stream/route.ts

## [ ] app/api/health (3)
- [ ] app/api/health/ocr/route.ts
- [ ] app/api/health/records/route.ts
- [ ] app/api/health/route.ts

## [ ] app/api/integrations (3)
- [ ] app/api/integrations/tractive/callback/route.ts
- [ ] app/api/integrations/tractive/connect/route.ts
- [ ] app/api/integrations/tractive/disconnect/route.ts

## [ ] app/api/newsletter (3)
- [ ] app/api/newsletter/confirm/route.ts
- [ ] app/api/newsletter/route.ts
- [ ] app/api/newsletter/unsubscribe/route.ts

## [ ] app/api/og (3)
- [ ] app/api/og/dog/route.tsx
- [ ] app/api/og/route.tsx
- [ ] app/api/og/sku/[code]/route.tsx

## [x] app/api/analysis (2) — 웨이브2 완료
- [ ] app/api/analysis/commentary/route.ts
- [ ] app/api/analysis/structured/route.ts

## [x] app/api/invitations (2) — 웨이브2 완료(401 수정)
- [ ] app/api/invitations/accept/route.ts
- [ ] app/api/invitations/create/route.ts

## [x] app/api/notifications (2) — 웨이브2 완료(500 수정)
- [ ] app/api/notifications/count/route.ts
- [ ] app/api/notifications/seen/route.ts

## [x] app/api/orders (2) — 웨이브2 완료(상태코드·쿠폰컬럼 수정)
- [ ] app/api/orders/[id]/cancel-items/route.ts
- [ ] app/api/orders/[id]/cancel/route.ts

## [ ] app/api/account (1)
- [ ] app/api/account/delete/route.ts

## [ ] app/api/auth (1)
- [ ] app/api/auth/welcome-email/route.ts

## [ ] app/api/consent (1)
- [ ] app/api/consent/unsubscribe-ack/route.ts

## [ ] app/api/contact (1)
- [ ] app/api/contact/route.ts

## [ ] app/api/cs (1)
- [ ] app/api/cs/reply/route.ts

## [ ] app/api/feeding-outcomes (1)
- [ ] app/api/feeding-outcomes/rating/route.ts

## [ ] app/api/marketing (1)
- [ ] app/api/marketing/unsubscribe/route.ts

## [ ] app/api/metrics (1)
- [ ] app/api/metrics/web-vitals/route.ts

## [ ] app/api/photo-upload (1)
- [ ] app/api/photo-upload/[token]/route.ts

## [ ] app/api/privacy (1)
- [ ] app/api/privacy/export/route.ts

## [ ] app/api/rewards (1)
- [ ] app/api/rewards/survey-completion/route.ts

## [ ] app/api/search (1)
- [ ] app/api/search/suggest/route.ts

## [ ] app/api/source-waitlist (1)
- [ ] app/api/source-waitlist/route.ts

## [ ] app/api/tracking (1)
- [ ] app/api/tracking/route.ts

## [ ] app/api/webhooks (1)
- [ ] app/api/webhooks/resend/route.ts

