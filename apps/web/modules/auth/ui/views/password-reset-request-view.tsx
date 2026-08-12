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
import { Input } from "@workspace/ui/components/input"
import Link from "next/link"

import { usePasswordResetRequestForm } from "@/modules/auth/hooks/use-password-reset-request-form"

export function PasswordResetRequestView() {
  const { form, isSubmitted, onSubmit } = usePasswordResetRequestForm()
  const isPending = form.formState.isSubmitting

  if (isSubmitted) {
    return (
      <div>
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
          <p className="mt-2 text-base text-muted-foreground">
            If an Echo account uses that address, we sent a password reset link.
          </p>
        </header>
        <Link
          href="/login"
          className="text-sm font-medium text-foreground underline underline-offset-4"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Enter your email and we&apos;ll send a reset link.
        </p>
      </header>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="m@example.com"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Sending link..." : "Send reset link"}
          </Button>
          <p className="pt-1 text-center text-sm text-muted-foreground">
            Remembered your password?{" "}
            <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </form>
      </Form>
    </div>
  )
}
