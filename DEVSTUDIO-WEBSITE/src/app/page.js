"use client"; 

import React from 'react'; 
import { PlaceholdersAndVanishInput } from "../../components/placeholders-and-vanish-input";
import { TextHoverEffect } from "../../components/text-hover-effect";
import Navbar from "../../components/navbar"; 
import { MacbookScroll } from '../../components/macbook';
import { Features } from '../../components/features-section';
import SectionStart from '../../components/section-start';
import { Tabs } from '../../components/tabs';
import { motion } from "motion/react";
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

  const DummyContent = () => {
    return (
      // <Image
      //   src="/linear.webp"
      //   alt="dummy image"
      //   width="1000"
      //   height="1000"
      //   className="object-cover object-left-top h-[60%]  md:h-[90%] absolute -bottom-10 inset-x-0 w-[90%] rounded-xl mx-auto"
      // />
      <p>hi</p>
    );
  };


  const tabs = [
    {
      title: "Product",
      value: "product",
      content: (
        <div className="w-full overflow-hidden relative h-full rounded-2xl p-10 text-xl md:text-4xl font-bold text-white bg-gradient-to-br from-purple-700 to-violet-900">
          <p>Product Tab</p>
          <DummyContent />
        </div>
      ),
    },
    {
      title: "Services",
      value: "services",
      content: (
        <div className="w-full overflow-hidden relative h-full rounded-2xl p-10 text-xl md:text-4xl font-bold text-white bg-gradient-to-br from-purple-700 to-violet-900">
          <p>Services tab</p>
          <DummyContent />
        </div>
      ),
    },
    {
      title: "Playground",
      value: "playground",
      content: (
        <div className="w-full overflow-hidden relative h-full rounded-2xl p-10 text-xl md:text-4xl font-bold text-white bg-gradient-to-br from-purple-700 to-violet-900">
          <p>Playground tab</p>
          <DummyContent />
        </div>
      ),
    },
    {
      title: "Content",
      value: "content",
      content: (
        <div className="w-full overflow-hidden relative h-full rounded-2xl p-10 text-xl md:text-4xl font-bold text-white bg-gradient-to-br from-purple-700 to-violet-900">
          <p>Content tab</p>
          <DummyContent />
        </div>
      ),
    },
    {
      title: "Random",
      value: "random",
      content: (
        <div className="w-full overflow-hidden relative h-full rounded-2xl p-10 text-xl md:text-4xl font-bold text-white bg-gradient-to-br from-purple-700 to-violet-900">
          <p>Random tab</p>
          <DummyContent />
        </div>
      ),
    },
  ];

 
  return (
    <>
     <div className="relative flex flex-col min-h-screen w-full bg-black text-neutral-200 overflow-x-hidden"> {/* Added overflow-x-hidden */}
      <Navbar />

      <div className="flex flex-grow flex-col items-center justify-center px-4 pt-28 sm:pt-32  text-center">

        <div className="mb-12 w-[50vw] h-[30vh]"> 
          <TextHoverEffect
            text="DevStudio"
            duration={1.5}
          />
        </div>

        <div className="w-full max-w-xl mb-12 md:mb-16"> {/* Control the width and add margin bottom */}
           <PlaceholdersAndVanishInput
              placeholders={placeholders}
              onSubmit={onSubmit}
           />
        </div>

        <p className="text-base sm:text-lg text-neutral-400 max-w-xl lg:max-w-2xl mb-10 md:mb-12">
          We are thrilled to unveil DevStudio, our most advanced platform yet,
          blending superior tooling with extensive development knowledge.
        </p>

         <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4">
            <button className="w-full sm:w-auto text-xs font-medium uppercase tracking-wider text-neutral-200 hover:text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-neutral-500 rounded-full px-6 py-2.5 transition-all duration-200">
                Build with DevStudio
            </button>
             <button className="w-full sm:w-auto text-xs font-medium uppercase tracking-wider text-neutral-200 hover:text-white border border-neutral-600 hover:border-neutral-300 rounded-full px-6 py-2.5 transition-all duration-200">
                Learn More
            </button>
         </div>

      </div>

       <div className="absolute bottom-6 sm:bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
           <svg className="w-5 h-5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7"></path></svg>
       </div>

       {/* <MacbookScroll showGradient={true} /> */}

       <SectionStart
      typingWords={[{ text: "Smart.", className:'text-neutral-400' }, { text: "Fast." , className:'text-neutral-400'}, { text: "AI-powered." , className:'text-neutral-400' }]}
      buttonText="Get Started"
      />
      
       <Features/>

       <SectionStart
      typingWords={[{ text: "See ", className:'text-neutral-400' }, { text: " Project. " , className:'text-neutral-400'}, { text: " Overview" , className:'text-neutral-400' }]}
      buttonText="Overview"
      />

<div className="h-[20rem] md:h-[40rem] [perspective:1000px] relative b flex flex-col max-w-5xl mx-auto w-full  items-start justify-start my-40 ">
      <Tabs tabs={tabs} />
    </div>

       


    </div>

    </>
   
  );
}