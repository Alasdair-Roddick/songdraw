"use client";

import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";

/**
 * The two things that have to wrap the whole tree, in one client boundary so
 * `app/layout.tsx` stays a server component and `children` keeps rendering on
 * the server.
 *
 * `MotionConfig reducedMotion="user"` is the important half. Nine files import
 * motion/react and not one of them carried a `motion-reduce:` guard — every
 * spring, shake and slide played regardless of the OS setting. Setting it here
 * covers all of them at once, rather than nine easily-forgotten class names.
 *
 * `attribute="class"` matches the `@custom-variant dark (&:is(.dark *))` in
 * globals.css. The `.dark` palette had existed for months as dead code: the
 * package was installed but never imported, so nothing ever applied the class.
 */
export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<ThemeProvider
			attribute="class"
			defaultTheme="light"
			enableSystem
			disableTransitionOnChange
		>
			<MotionConfig reducedMotion="user">{children}</MotionConfig>
		</ThemeProvider>
	);
}
