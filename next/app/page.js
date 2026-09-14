import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import KeyNumbers from "@/components/KeyNumbers";
import Approach from "@/components/Approach";
import Work from "@/components/Work";
import AISystems from "@/components/AISystems";
import Delivery from "@/components/Delivery";
import AskChatbox from "@/components/AskChatbox";
import About from "@/components/About";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navigation />
      <main id="main">
        <span id="top"></span>
        <Hero />
        <KeyNumbers />
        <AskChatbox />
        <Approach />
        <Work />
        <AISystems />
        <Delivery />
        <About />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
