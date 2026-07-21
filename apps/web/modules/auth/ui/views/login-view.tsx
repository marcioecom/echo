"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
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

import { useLoginForm } from "@/modules/auth/hooks/use-login-form"

export function LoginView() {
  const { form, onSubmit } = useLoginForm()
  const isPending = form.formState.isSubmitting

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Sign in to Echo</CardTitle>
        <CardDescription>
          Access your organization&apos;s support workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Signing in..." : "Sign in"}
            </Button>
            <p className="text-center text-xs/relaxed text-muted-foreground">
              No account yet?{" "}
              <Link
                href="/sign-up"
                className="text-foreground underline underline-offset-4"
              >
                Create one
              </Link>
            </p>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
