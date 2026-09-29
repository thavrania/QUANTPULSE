import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { QuantPulseProvider } from '@/context/QuantPulseContext';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { JsonPayloadModal } from '@/components/modals/JsonPayloadModal';
import { AddStockModal } from '@/components/modals/AddStockModal';
import { BrokerSettingsModal } from '@/components/modals/BrokerSettingsModal';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'QuantPulse — 20-Day Volume Crossover & Options Execution Terminal',
  description:
    'Institutional-grade 20-Day Volume Crossover Screener & Options Execution Terminal with exact timestamp latching and trailing stop-loss management.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen flex flex-col bg-obsidian text-slate-100 selection:bg-emerald-500/30 selection:text-emerald-200">
        <QuantPulseProvider>
          {children}
          <JsonPayloadModal />
          <AddStockModal />
          <BrokerSettingsModal />
          <ToastContainer />
        </QuantPulseProvider>
      </body>
    </html>
  );
}
