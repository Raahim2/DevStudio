"use client";

import React, { useEffect } from 'react';
import Head from 'next/head';
import Navbar from "../../components/navbar";
import { PlaceholdersAndVanishInput } from "../../components/placeholders-and-vanish-input";
import { TextHoverEffect } from "../../components/text-hover-effect";
import { Features } from "../../components/features-section";
import SectionStart from "../../components/section-start";
import { Tabs } from "../../components/tabs";
// import { MacbookScroll } from "../../components/macbook";
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

  const tabs = [
    {
      title: "Product",
      value: "product",
      content: (
        <div className="w-full h-full p-10 rounded-2xl text-xl md:text-4xl font-bold bg-gradient-to-br from-purple-100 to-violet-200 dark:from-purple-700 dark:to-violet-900 text-gray-800 dark:text-white">
          <p>Product Tab</p>
          <DummyContent />
        </div>
      ),
    },
    {
      title: "Services",
      value: "services",
      content: (
        <div className="w-full h-full p-10 rounded-2xl text-xl md:text-4xl font-bold bg-gradient-to-br from-green-100 to-blue-200 dark:from-green-700 dark:to-blue-900 text-gray-800 dark:text-white">
          <p>Services Tab</p>
          <DummyContent />
        </div>
      ),
    },
    {
      title: "Playground",
      value: "playground",
      content: (
        <div className="w-full h-full p-10 rounded-2xl text-xl md:text-4xl font-bold bg-gradient-to-br from-red-100 to-orange-200 dark:from-red-700 dark:to-orange-900 text-gray-800 dark:text-white">
          <p>Playground Tab</p>
          <DummyContent />
        </div>
      ),
    },
    {
      title: "Content",
      value: "content",
      content: (
        <div className="w-full h-full p-10 rounded-2xl text-xl md:text-4xl font-bold bg-gradient-to-br from-yellow-100 to-lime-200 dark:from-yellow-700 dark:to-lime-900 text-gray-800 dark:text-white">
          <p>Content Tab</p>
          <DummyContent />
        </div>
      ),
    },
    {
      title: "Random",
      value: "random",
      content: (
        <div className="w-full h-full p-10 rounded-2xl text-xl md:text-4xl font-bold bg-gradient-to-br from-cyan-100 to-indigo-200 dark:from-cyan-700 dark:to-indigo-900 text-gray-800 dark:text-white">
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
      </Head>

      <div className="relative flex flex-col min-h-screen w-full bg-white text-gray-800 dark:bg-black dark:text-neutral-200 overflow-x-hidden transition-colors duration-300">
        <Navbar />

        <main className="flex flex-grow flex-col items-center justify-center px-4 pt-28 sm:pt-32 text-center">
          <div className="mb-12 w-[50vw] h-[30vh]">
            <TextHoverEffect text="DevStudio" duration={0.5} />
          </div>

          <div className="w-full max-w-xl mb-12 md:mb-16">
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
            <button className="w-full sm:w-auto text-xs font-medium uppercase tracking-wider rounded-full px-6 py-2.5 transition-all duration-200
                                bg-gray-900 text-white hover:bg-gray-800 border border-gray-900 hover:border-gray-700
                                dark:bg-neutral-800 dark:text-neutral-200 dark:hover:text-white dark:hover:bg-neutral-700 dark:border dark:border-neutral-700 dark:hover:border-neutral-500">
              Build with DevStudio
            </button>
            <button className="w-full sm:w-auto text-xs font-medium uppercase tracking-wider rounded-full px-6 py-2.5 transition-all duration-200
                                text-gray-800 hover:text-black border border-gray-400 hover:border-gray-600
                                dark:text-neutral-200 dark:hover:text-white dark:border dark:border-neutral-600 dark:hover:border-neutral-300">
              Learn More
            </button>
          </div>
        </main>

        <div className="absolute bottom-6 sm:bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <svg className="w-5 h-5 text-gray-500 dark:text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7"></path>
          </svg>
        </div>

        {/* Optional Macbook Scroll */}
        {/* <MacbookScroll showGradient={true} /> */}

        <SectionStart
          typingWords={[
            { text: "Smart.", className: "text-gray-700 dark:text-neutral-400" },
            { text: "Fast.", className: "text-gray-700 dark:text-neutral-400" },
            { text: "AI-powered.", className: "text-gray-700 dark:text-neutral-400" },
          ]}
          buttonText="Get Started"
        />

        <Features />

        <SectionStart
          typingWords={[
            { text: "See ", className: "text-gray-700 dark:text-neutral-400" },
            { text: " Project. ", className: "text-gray-700 dark:text-neutral-400" },
            { text: " Overview", className: "text-gray-700 dark:text-neutral-400" },
          ]}
          buttonText="Overview"
        />

        <div className="h-[20rem] md:h-[40rem] [perspective:1000px] relative flex flex-col max-w-5xl mx-auto w-full items-start justify-start my-40">
          <Tabs tabs={tabs} />
        </div>
      </div>
    </>
  );
}
