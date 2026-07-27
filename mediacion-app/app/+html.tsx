import React from 'react';

export default function RootHtml({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <style id="expo-reset" />
      </head>
      <body>{children}</body>
    </html>
  );
}
