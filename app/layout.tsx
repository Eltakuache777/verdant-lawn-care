import "./globals.css";
import ChatWidget from "./components/ChatWidget";
import NavBar from "./components/NavBar";
import { LanguageProvider } from "./components/LanguageProvider";
import { ChatProvider } from "./components/ChatContext";

export const metadata = {
  title: "Verdant Lawn Care — Your lawn, handled.",
  description: "Professional mowing, edging & trim for homes right in your neighborhood.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <ChatProvider>
            <NavBar />
            {children}
            <ChatWidget />
          </ChatProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
