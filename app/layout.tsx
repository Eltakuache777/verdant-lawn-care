import "./globals.css";
import ChatWidget from "./components/ChatWidget";
import AssistantWidget from "./components/AssistantWidget";
import FeedbackWidget from "./components/FeedbackWidget";
import NavBar from "./components/NavBar";
import NotificationPrompt from "./components/NotificationPrompt";
import { LanguageProvider } from "./components/LanguageProvider";
import { ChatProvider } from "./components/ChatContext";
import { AssistantProvider } from "./components/AssistantContext";
import { FeedbackProvider } from "./components/FeedbackContext";

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
              <FeedbackProvider>
                <NavBar />
                {children}
                <ChatWidget />
                <AssistantWidget />
                <FeedbackWidget />
                <NotificationPrompt />
              </FeedbackProvider>
            </AssistantProvider>
          </ChatProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
