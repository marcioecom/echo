"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form"
import Link from "next/link"

import { usePasswordResetForm } from "@/modules/auth/hooks/use-password-reset-form"
import { PasswordInput } from "@/modules/auth/ui/components/password-input"

export function PasswordResetView() {
  const { form, hasValidToken, onSubmit } = usePasswordResetForm()
  const isPending = form.formState.isSubmitting

  if (!hasValidToken) {
    return (
      <div>
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Link unavailable</h1>
          <p className="mt-2 text-base text-muted-foreground">
            This password reset link is invalid or has expired. Request a new one.
          </p>
        </header>
        <Link
          href="/forgot-password"
          className="text-sm font-medium text-foreground underline underline-offset-4"
        >
          Request a new link
        </Link>
      </div>
    )
  }

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Use at least 8 characters. You&apos;ll be signed out everywhere else.
        </p>
      </header>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm new password</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Resetting password..." : "Reset password"}
          </Button>
        </form>
      </Form>
    </div>
  )
}
