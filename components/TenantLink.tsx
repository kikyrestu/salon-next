"use client";

import NextLink from 'next/link';
import { useParams } from 'next/navigation';
import { ComponentProps } from 'react';

type LinkProps = ComponentProps<typeof NextLink>;

export default function TenantLink({ href, ...props }: LinkProps) {
  const params = useParams();
  const slug = params?.slug as string;

  let finalHref = href;
  
  if (typeof href === 'string' && href.startsWith('/')) {
      finalHref = slug ? `/${slug}${href}` : href;
  } else if (typeof href === 'object' && href.pathname?.startsWith('/')) {
      finalHref = {
          ...href,
          pathname: slug ? `/${slug}${href.pathname}` : href.pathname
      };
  }

  return <NextLink href={finalHref} {...props} />;
}
