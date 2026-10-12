import { t } from "@/lib/i18n"

export function loginHead() {
  return {
    meta: [{ title: t("auth.login.metaTitle") }],
  }
}

export function signUpHead() {
  return {
    meta: [{ title: t("auth.signUp.metaTitle") }],
  }
}

export function passwordResetRequestHead() {
  return {
    meta: [{ title: t("auth.resetRequest.metaTitle") }],
  }
}

export function passwordResetHead() {
  return {
    meta: [{ title: t("auth.reset.metaTitle") }],
  }
}

export function onboardingHead() {
  return {
    meta: [{ title: t("auth.onboarding.metaTitle") }],
  }
}
