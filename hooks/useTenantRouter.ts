"use client";

import { useRouter, useParams } from 'next/navigation';

export function useTenantRouter() {
    const router = useRouter();
    const params = useParams();
    const slug = params?.slug as string;

    const prependSlug = (url: string) => {
        if (url.startsWith('/') && slug) {
            return `/${slug}${url}`;
        }
        return url;
    };

    return {
        ...router,
        push: (href: string, options?: any) => router.push(prependSlug(href), options),
        replace: (href: string, options?: any) => router.replace(prependSlug(href), options),
        prefetch: (href: string) => router.prefetch(prependSlug(href)),
    };
}
