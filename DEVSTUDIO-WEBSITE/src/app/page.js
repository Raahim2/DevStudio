"use client";

import React, { useEffect } from 'react';
import Head from 'next/head';
import Navbar from "../../components/navbar";
import { PlaceholdersAndVanishInput } from "../../components/placeholders-and-vanish-input";
import { TextHoverEffect } from "../../components/text-hover-effect";
import { Features } from "../../components/features-section";
import SectionStart from "../../components/section-start";
import { Tabs } from "../../components/tabs";
import { MacbookScroll } from "../../components/macbook";
import FAQ from '../../components/faq';
import GetStartedSection from '../components/get-started-section'; // <-- Import the new component
import './globals.css';

export default function HomePage() {
  const placeholders = [
    "Ask Grok anything...",
    "What's the latest news?",
    "Explain quantum computing simply",
    "Summarize the concept of multimodal AI",
    "Compare Grok with other models",
  ];

  const onSubmit = (value) => {
    console.log("Submitted:", value);
  };

  const DummyContent = () => (
    <p className="text-inherit">hi</p>
  );

  // Tabs definition remains the same...
  const tabs = [
    // ... (your tabs array)
     {
      title: "Product",
      value: "product",
      content: (
        <div className="w-full h-full p-6 md:p-10 rounded-2xl text-xl md:text-4xl font-bold bg-gradient-to-br from-purple-100 to-violet-200 dark:from-purple-700 dark:to-violet-900 text-gray-800 dark:text-white">
          <p>Product Tab</p>
          <DummyContent />
        </div>
      ),
    },
    {
      title: "Services",
      value: "services",
      content: (
        <div className="w-full h-full p-6 md:p-10 rounded-2xl text-xl md:text-4xl font-bold bg-gradient-to-br from-green-100 to-blue-200 dark:from-green-700 dark:to-blue-900 text-gray-800 dark:text-white">
          <p>Services Tab</p>
          <DummyContent />
        </div>
      ),
    },
    {
      title: "Playground",
      value: "playground",
      content: (
        <div className="w-full h-full p-6 md:p-10 rounded-2xl text-xl md:text-4xl font-bold bg-gradient-to-br from-red-100 to-orange-200 dark:from-red-700 dark:to-orange-900 text-gray-800 dark:text-white">
          <p>Playground Tab</p>
          <DummyContent />
        </div>
      ),
    },
    {
      title: "Content",
      value: "content",
      content: (
        <div className="w-full h-full p-6 md:p-10 rounded-2xl text-xl md:text-4xl font-bold bg-gradient-to-br from-yellow-100 to-lime-200 dark:from-yellow-700 dark:to-lime-900 text-gray-800 dark:text-white">
          <p>Content Tab</p>
          <DummyContent />
        </div>
      ),
    },
    {
      title: "Random",
      value: "random",
      content: (
        <div className="w-full h-full p-6 md:p-10 rounded-2xl text-xl md:text-4xl font-bold bg-gradient-to-br from-cyan-100 to-indigo-200 dark:from-cyan-700 dark:to-indigo-900 text-gray-800 dark:text-white">
          <p>Random Tab</p>
          <DummyContent />
        </div>
      ),
    },
  ];


  useEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  return (
    <>
      <Head>
        <title>DevStudio - AI-Powered Development</title>
        <meta name="description" content="DevStudio is an AI-powered platform for smarter, faster development." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* <link rel="icon" href="/favicon.ico" /> */}
      </Head>

      {/* --- Outer Container --- */}
      {/* Removed horizontal padding from here, let sections manage their own if needed */}
      <div className="relative flex flex-col min-h-screen w-full bg-white text-gray-800 dark:bg-black dark:text-neutral-200 overflow-x-hidden transition-colors duration-300">
        <Navbar />

        {/* --- Hero Section --- */}
        {/* Added px-4 sm:px-6 lg:px-8 here for hero content */}
        <main className="flex flex-grow flex-col items-center justify-center pt-28 sm:pt-32 pb-16 md:pb-24 text-center px-4 sm:px-6 lg:px-8">
          {/* ... (rest of hero content: TextHoverEffect, Input, Paragraph, Buttons) */}
           <div className="mb-10 md:mb-12 w-[60vw] sm:w-[50vw] h-[25vh] sm:h-[30vh]">
            <TextHoverEffect text="DevStudio" duration={0.5} />
          </div>

          <div className="w-full max-w-xl mb-10 md:mb-12">
            <PlaceholdersAndVanishInput
              placeholders={placeholders}
              onSubmit={onSubmit}
            />
          </div>

          <p className="text-base sm:text-lg text-gray-700 dark:text-neutral-400 max-w-xl lg:max-w-2xl mb-10 md:mb-12">
            We are thrilled to unveil DevStudio, our most advanced platform yet,
            blending superior tooling with extensive development knowledge.
          </p>

          <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4">
            <button className="w-full sm:w-auto text-xs sm:text-sm font-medium uppercase tracking-wider rounded-full px-6 py-2.5 sm:px-7 sm:py-3 transition-all duration-200
                                bg-gray-900 text-white hover:bg-gray-800 border border-gray-900 hover:border-gray-700
                                dark:bg-neutral-800 dark:text-neutral-200 dark:hover:text-white dark:hover:bg-neutral-700 dark:border dark:border-neutral-700 dark:hover:border-neutral-500">
              Build with DevStudio
            </button>
            <button className="w-full sm:w-auto text-xs sm:text-sm font-medium uppercase tracking-wider rounded-full px-6 py-2.5 sm:px-7 sm:py-3 transition-all duration-200
                                text-gray-800 hover:text-black border border-gray-400 hover:border-gray-600
                                dark:text-neutral-200 dark:hover:text-white dark:border dark:border-neutral-600 dark:hover:border-neutral-300">
              Learn More
            </button>
          </div>
        </main>
""
        {/* --- Bouncing Arrow --- */}
        {/* Keep this positioned relative to the outer container if desired */}
        <div className="absolute bottom-8 md:bottom-10 left-1/2 transform -translate-x-1/2 animate-bounce z-10"> {/* Added z-index */}
          <svg className="w-6 h-6 text-gray-500 dark:text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7"></path>
          </svg>
        </div>

        {/* --- Optional Macbook Scroll --- */}
        <div className="my-16 md:my-24"> <MacbookScroll showGradient={true} src="https://res.cloudinary.com/dtykfxrql/video/upload/v1744085710/demo_q1fsxu.mp4"/> </div>


        {/* --- Section Dividers and Content --- */}
        {/* Using wrapper divs with margin for spacing between sections */}

        {/* --- SectionStart 1 --- */}
        <div className="my-16 md:my-24 px-4 sm:px-6 lg:px-8"> {/* Added padding */}
          <SectionStart
            typingWords={[
              { text: "Smart.", className: "text-gray-700 dark:text-neutral-400" },
              { text: "Fast.", className: "text-gray-700 dark:text-neutral-400" },
              { text: "AI-powered.", className: "text-gray-700 dark:text-neutral-400" },
            ]}
            buttonText="Get Started"
          />
        </div>

        {/* --- Features Section --- */}
        <div className="my-16 md:my-24 px-4 sm:px-6 lg:px-8"> {/* Added padding */}
          <Features />
        </div>

        {/* --- SectionStart 2 --- */}
        {/* <div className="my-16 md:my-24 px-4 sm:px-6 lg:px-8"> 
          <SectionStart
            typingWords={[
              { text: "See ", className: "text-gray-700 dark:text-neutral-400" },
              { text: " Project. ", className: "text-gray-700 dark:text-neutral-400" },
              { text: " Overview", className: "text-gray-700 dark:text-neutral-400" },
            ]}
            buttonText="Overview"
          />
        </div> */}

        {/* --- Tabs Section --- */}
        {/* Container needs vertical margin. Max-width and centering are good. */}
        {/* Let Tabs component handle its own internal padding if needed */}
        {/* <div className="h-[20rem] md:h-[40rem] [perspective:1000px] relative flex flex-col max-w-5xl mx-auto w-full items-start justify-start my-16 md:my-24 px-4 sm:px-6 lg:px-8"> */}
           {/* Added horizontal padding */}
          {/* <Tabs tabs={tabs} /> */}
        {/* </div> */}

        {/* --- SectionStart 3 --- */}
        <div className="my-16 md:my-24 px-4 sm:px-6 lg:px-8"> {/* Added padding */}
          <SectionStart
            typingWords={[
              { text: "See ", className: "text-gray-700 dark:text-neutral-400" },
              { text: " Project. ", className: "text-gray-700 dark:text-neutral-400" },
              { text: " FAQ's", className: "text-gray-700 dark:text-neutral-400" },
            ]}
            buttonText="FAQ's"
          />
        </div>

        {/* --- FAQ Section --- */}
        {/* Let FAQ handle its own padding via max-w-3xl mx-auto px-4 etc. */}
        {/* Added bottom margin to the wrapper div */}
        <div className="my-16 md:my-24">
           {/* Removed fixed height/perspective. Let FAQ control its size */}
           <FAQ/>
        </div>

        {/* --- Get Started Section --- */}
        {/* This component handles its own background and padding */}
        {/* No extra margin needed here as the component has py-16/py-24 */}
        <GetStartedSection />

        {/* --- Footer --- */}
        {/* Add Footer component here if you have one */}
        {/* <Footer /> */}

      </div> {/* End of main outer container */}
    </>
  );
}