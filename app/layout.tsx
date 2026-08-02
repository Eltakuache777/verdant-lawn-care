import "./globals.css";
import ChatWidget from "./components/ChatWidget";
import AssistantWidget from "./components/AssistantWidget";
import NavBar from "./components/NavBar";
import NotificationPrompt from "./components/NotificationPrompt";
import { LanguageProvider } from "./components/LanguageProvider";
import { ChatProvider } from "./components/ChatContext";
import { AssistantProvider } from "./components/AssistantContext";

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
            <AssistantProvider>
              <NavBar />
              {children}
              <ChatWidget />
              <AssistantWidget />
              <NotificationPrompt />
            </AssistantProvider>
          </ChatProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
