"use client";
import React, { useEffect, useRef, useState } from "react";
// Make sure motion/react is installed if you are using this directly
// npm install motion react react-dom
// Or if using framer-motion:
// import { motion, useScroll, useTransform } from "framer-motion";
import { motion, useScroll, useTransform } from "framer-motion"; // Using framer-motion as it's more common and robust
import { cn } from "../src/lib/utils"; // Assuming you have this utility
import {
  IconBrightnessDown,
  IconBrightnessUp,
  IconCaretRightFilled,
  IconCaretUpFilled,
  IconChevronUp,
  IconMicrophone,
  IconMoon,
  IconPlayerSkipForward,
  IconPlayerTrackNext,
  IconPlayerTrackPrev,
  IconTable,
  IconVolume,
  IconVolume2,
  IconVolume3,
} from "@tabler/icons-react";
import { IconSearch } from "@tabler/icons-react";
import { IconWorld } from "@tabler/icons-react";
import { IconCommand } from "@tabler/icons-react";
import { IconCaretLeftFilled } from "@tabler/icons-react";
import { IconCaretDownFilled } from "@tabler/icons-react";
// Removed Image import from next/image
// import Image from "next/image";

// --- MacbookScroll Component (No changes needed here) ---
export const MacbookScroll = ({
  src, // This prop now expects a video URL string
  showGradient,
  badge,
}) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if window is defined (for SSR safety)
    if (typeof window !== "undefined") {
      const checkMobile = () => {
        setIsMobile(window.innerWidth < 768);
      };
      checkMobile(); // Initial check
      window.addEventListener("resize", checkMobile); // Check on resize

      // Cleanup listener on component unmount
      return () => window.removeEventListener("resize", checkMobile);
    }
  }, []);

  const scaleX = useTransform(scrollYProgress, [0, 0.5], [1.2, isMobile ? 1 : 2.3]);
  const scaleY = useTransform(scrollYProgress, [0, 0.3], [0.6, isMobile ? 1 : 1.7]);
  const translate = useTransform(scrollYProgress, [0, 0.3], [0, isMobile ? 100 : 300]); // Adjusted mobile translate
  const rotate = useTransform(scrollYProgress, [0.1, 0.12, 0.3], [-28, -28, 0]);
  const textTransform = useTransform(scrollYProgress, [0, 0.3], [0, 100]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);

  return (
    <div
      ref={ref}
      className="flex min-h-[200vh] flex-col items-center justify-start py-0 [perspective:800px]" // Increased min-h for better scroll effect
    >
      {/* Added outer container for scaling to prevent layout shifts */}
      <div className="sticky top-0 flex h-screen w-full items-start justify-center">
        <div className="relative scale-[0.35] transform sm:scale-50 md:scale-100 md:pt-20">
          <motion.h2
            style={{
              translateY: textTransform,
              opacity: textOpacity,
            }}
            className="mb-20 text-center text-3xl font-bold text-neutral-800 dark:text-white w-fit h-fit "
          >
            {/* Optional Title Here */}
          </motion.h2>
          {/* Lid */}
          <Lid
            src={src} // Pass the video URL here
            scaleX={scaleX}
            scaleY={scaleY}
            rotate={rotate}
            translate={translate}
          />
          {/* Base area */}
          <div className="relative -z-10 h-[22rem] w-[32rem] overflow-hidden rounded-2xl bg-gray-200 dark:bg-[#272729]">
            {/* above keyboard bar */}
            <div className="relative h-10 w-full">
              <div className="absolute inset-x-0 mx-auto h-4 w-[80%] bg-[#050505]" />
            </div>
            <div className="relative flex">
              <div className="mx-auto h-full w-[10%] overflow-hidden">
                <SpeakerGrid />
              </div>
              <div className="mx-auto h-full w-[80%]">
                <Keypad />
              </div>
              <div className="mx-auto h-full w-[10%] overflow-hidden">
                <SpeakerGrid />
              </div>
            </div>
            <Trackpad />
            <div className="absolute inset-x-0 bottom-0 mx-auto h-2 w-20 rounded-tl-3xl rounded-tr-3xl bg-gradient-to-t from-[#272729] to-[#050505]" />
            {showGradient && (
              <div className="absolute inset-x-0 bottom-0 z-50 h-40 w-full bg-gradient-to-t from-white via-white to-transparent dark:from-black dark:via-black"></div>
            )}
            {badge && <div className="absolute bottom-4 left-4">{badge}</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Lid Component (MODIFIED) ---
export const Lid = ({
  scaleX,
  scaleY,
  rotate,
  translate,
  src, // Expects a video URL string
}) => {
  return (
    <div className="relative [perspective:800px]">
      {/* Top layer with logo */}
      <div
        style={{
          transform: "perspective(800px) rotateX(-25deg) translateZ(0px)",
          transformOrigin: "bottom",
          transformStyle: "preserve-3d",
        }}
        className="relative h-[12rem] w-[32rem] rounded-2xl bg-[#010101] p-2"
      >
        <div
          style={{
            boxShadow: "0px 2px 0px 2px #171717 inset",
          }}
          className="absolute inset-0 flex items-center justify-center rounded-lg bg-[#010101]"
        >
          <span className="text-white">
            <AceternityLogo />
          </span>
        </div>
      </div>

      {/* Screen layer */}
      <motion.div
        style={{
          scaleX: scaleX,
          scaleY: scaleY,
          rotateX: rotate,
          translateY: translate,
          transformStyle: "preserve-3d",
          transformOrigin: "top",
        }}
        className="absolute inset-0 -top-2 h-96 w-[32rem] rounded-2xl bg-[#010101] p-2" // Added slight negative top margin for better alignment
      >
        {/* Screen Bezel */}
        <div className="absolute inset-0 rounded-lg bg-[#272729]" />

        {/* Video Player - Replaced Image */}
        <video
          src={src}
          autoPlay
          muted // Important for autoplay in most browsers
          loop
          playsInline // Important for inline playback on mobile
          className="absolute inset-0 h-full w-full rounded-lg object-cover object-center p-[1px]" // Added tiny padding to prevent bleed
          // You might need to add specific video file types if src alone isn't enough
          // <source src={src} type="video/mp4" />
        />
      </motion.div>
    </div>
  );
};

// --- Other Components (Trackpad, Keypad, KBtn, SpeakerGrid, OptionKey, AceternityLogo) remain the same ---

export const Trackpad = () => {
    return (
      <div
        className="mx-auto my-1 h-32 w-[40%] rounded-xl bg-gray-100 dark:bg-[#1B1B1F]" // Slightly lighter bg for contrast
        style={{
          boxShadow: "0px 0px 1px 1px #00000020 inset",
        }}></div>
    );
  };

  export const Keypad = () => {
    return (
      <div
        className="mx-1 h-full rounded-md bg-[#050505] p-1"
      >
        {/* First Row */}
        <Row>
          <KBtn className="w-10 items-end justify-start pb-[2px] pl-[4px]" childrenClassName="items-start">esc</KBtn>
          <KBtn><IconBrightnessDown className="h-[6px] w-[6px]" /><span className="mt-1 inline-block">F1</span></KBtn>
          <KBtn><IconBrightnessUp className="h-[6px] w-[6px]" /><span className="mt-1 inline-block">F2</span></KBtn>
          <KBtn><IconTable className="h-[6px] w-[6px]" /><span className="mt-1 inline-block">F3</span></KBtn>
          <KBtn><IconSearch className="h-[6px] w-[6px]" /><span className="mt-1 inline-block">F4</span></KBtn>
          <KBtn><IconMicrophone className="h-[6px] w-[6px]" /><span className="mt-1 inline-block">F5</span></KBtn>
          <KBtn><IconMoon className="h-[6px] w-[6px]" /><span className="mt-1 inline-block">F6</span></KBtn>
          <KBtn><IconPlayerTrackPrev className="h-[6px] w-[6px]" /><span className="mt-1 inline-block">F7</span></KBtn>
          <KBtn><IconPlayerSkipForward className="h-[6px] w-[6px]" /><span className="mt-1 inline-block">F8</span></KBtn>
          <KBtn><IconPlayerTrackNext className="h-[6px] w-[6px]" /><span className="mt-1 inline-block">F9</span></KBtn> {/* Corrected F9 */}
          <KBtn><IconVolume3 className="h-[6px] w-[6px]" /><span className="mt-1 inline-block">F10</span></KBtn>
          <KBtn><IconVolume2 className="h-[6px] w-[6px]" /><span className="mt-1 inline-block">F11</span></KBtn>
          <KBtn><IconVolume className="h-[6px] w-[6px]" /><span className="mt-1 inline-block">F12</span></KBtn>
          <KBtn>
            <div className="h-4 w-4 rounded-full bg-gradient-to-b from-neutral-900 from-20% via-black via-50% to-neutral-900 to-95% p-px">
              <div className="h-full w-full rounded-full bg-black" />
            </div>
          </KBtn>
        </Row>

        {/* Second row */}
        <Row>
          <KBtn><span className="block">~</span><span className="mt-1 block">`</span></KBtn>
          <KBtn><span className="block">!</span><span className="block">1</span></KBtn>
          <KBtn><span className="block">@</span><span className="block">2</span></KBtn>
          <KBtn><span className="block">#</span><span className="block">3</span></KBtn>
          <KBtn><span className="block">$</span><span className="block">4</span></KBtn>
          <KBtn><span className="block">%</span><span className="block">5</span></KBtn>
          <KBtn><span className="block">^</span><span className="block">6</span></KBtn>
          <KBtn><span className="block">&</span><span className="block">7</span></KBtn>
          <KBtn><span className="block">*</span><span className="block">8</span></KBtn>
          <KBtn><span className="block">(</span><span className="block">9</span></KBtn>
          <KBtn><span className="block">)</span><span className="block">0</span></KBtn>
          <KBtn><span className="block">—</span><span className="block">_</span></KBtn>
          <KBtn><span className="block">+</span><span className="block"> = </span></KBtn>
          <KBtn className="w-10 items-end justify-end pr-[4px] pb-[2px]" childrenClassName="items-end">delete</KBtn>
        </Row>

        {/* Third row */}
        <Row>
          <KBtn className="w-10 items-end justify-start pb-[2px] pl-[4px]" childrenClassName="items-start">tab</KBtn>
          <KBtn><span className="block">Q</span></KBtn>
          <KBtn><span className="block">W</span></KBtn>
          <KBtn><span className="block">E</span></KBtn>
          <KBtn><span className="block">R</span></KBtn>
          <KBtn><span className="block">T</span></KBtn>
          <KBtn><span className="block">Y</span></KBtn>
          <KBtn><span className="block">U</span></KBtn>
          <KBtn><span className="block">I</span></KBtn>
          <KBtn><span className="block">O</span></KBtn>
          <KBtn><span className="block">P</span></KBtn>
          <KBtn><span className="block">{`{`}</span><span className="block">{`[`}</span></KBtn>
          <KBtn><span className="block">{`}`}</span><span className="block">{`]`}</span></KBtn>
          <KBtn><span className="block">{`|`}</span><span className="block">{`\\`}</span></KBtn>
        </Row>

        {/* Fourth Row */}
        <Row>
          <KBtn className="w-[2.8rem] items-end justify-start pb-[2px] pl-[4px]" childrenClassName="items-start">caps lock</KBtn>
          <KBtn><span className="block">A</span></KBtn>
          <KBtn><span className="block">S</span></KBtn>
          <KBtn><span className="block">D</span></KBtn>
          <KBtn><span className="block">F</span></KBtn>
          <KBtn><span className="block">G</span></KBtn>
          <KBtn><span className="block">H</span></KBtn>
          <KBtn><span className="block">J</span></KBtn>
          <KBtn><span className="block">K</span></KBtn>
          <KBtn><span className="block">L</span></KBtn>
          <KBtn><span className="block">{`:`}</span><span className="block">{`;`}</span></KBtn>
          <KBtn><span className="block">{`"`}</span><span className="block">{`'`}</span></KBtn>
          <KBtn className="w-[2.85rem] items-end justify-end pr-[4px] pb-[2px]" childrenClassName="items-end">return</KBtn>
        </Row>

        {/* Fifth Row */}
         <Row>
          <KBtn className="w-[3.65rem] items-end justify-start pb-[2px] pl-[4px]" childrenClassName="items-start">shift</KBtn>
          <KBtn><span className="block">Z</span></KBtn>
          <KBtn><span className="block">X</span></KBtn>
          <KBtn><span className="block">C</span></KBtn>
          <KBtn><span className="block">V</span></KBtn>
          <KBtn><span className="block">B</span></KBtn>
          <KBtn><span className="block">N</span></KBtn>
          <KBtn><span className="block">M</span></KBtn>
          <KBtn><span className="block">{`<`}</span><span className="block">{`,`}</span></KBtn>
          <KBtn><span className="block">{`>`}</span><span className="block">{`.`}</span></KBtn>
          <KBtn><span className="block">{`?`}</span><span className="block">{`/`}</span></KBtn>
          <KBtn className="w-[3.65rem] items-end justify-end pr-[4px] pb-[2px]" childrenClassName="items-end">shift</KBtn>
        </Row>

        {/* sixth Row */}
        <Row>
          <KBtn className="" childrenClassName="h-full justify-between py-[4px]">
            <div className="flex w-full justify-end pr-1"><span className="block">fn</span></div>
            <div className="flex w-full justify-start pl-1"><IconWorld className="h-[6px] w-[6px]" /></div>
          </KBtn>
          <KBtn className="" childrenClassName="h-full justify-between py-[4px]">
            <div className="flex w-full justify-end pr-1"><IconChevronUp className="h-[6px] w-[6px]" /></div>
            <div className="flex w-full justify-start pl-1"><span className="block">control</span></div>
          </KBtn>
          <KBtn className="" childrenClassName="h-full justify-between py-[4px]">
            <div className="flex w-full justify-end pr-1"><OptionKey className="h-[6px] w-[6px]" /></div>
            <div className="flex w-full justify-start pl-1"><span className="block">option</span></div>
          </KBtn>
          <KBtn className="w-8" childrenClassName="h-full justify-between py-[4px]">
            <div className="flex w-full justify-end pr-1"><IconCommand className="h-[6px] w-[6px]" /></div>
            <div className="flex w-full justify-start pl-1"><span className="block">command</span></div>
          </KBtn>
          <KBtn className="w-[8.2rem]"></KBtn> {/* Space bar */}
          <KBtn className="w-8" childrenClassName="h-full justify-between py-[4px]">
             <div className="flex w-full justify-start pl-1"><IconCommand className="h-[6px] w-[6px]" /></div>
            <div className="flex w-full justify-start pl-1"><span className="block">command</span></div>
          </KBtn>
          <KBtn className="" childrenClassName="h-full justify-between py-[4px]">
            <div className="flex w-full justify-start pl-1"><OptionKey className="h-[6px] w-[6px]" /></div>
            <div className="flex w-full justify-start pl-1"><span className="block">option</span></div>
          </KBtn>
          <div className="mt-[2px] flex h-6 w-[4.9rem] flex-col items-center justify-end rounded-[4px] p-[0.5px]"> {/* Arrow keys container */}
              <KBtn className="h-3 w-6"><IconCaretUpFilled className="h-[6px] w-[6px]" /></KBtn>
              <div className="flex">
                <KBtn className="h-3 w-6"><IconCaretLeftFilled className="h-[6px] w-[6px]" /></KBtn>
                <KBtn className="h-3 w-6"><IconCaretDownFilled className="h-[6px] w-[6px]" /></KBtn>
                <KBtn className="h-3 w-6"><IconCaretRightFilled className="h-[6px] w-[6px]" /></KBtn>
              </div>
            </div>
        </Row>
      </div>
    );
  };

  // Helper to reduce repetition
  const Row = ({ children }) => (
    <div className="mb-[2px] flex w-full shrink-0 gap-[2px]">{children}</div>
  );


  export const KBtn = ({
    className,
    children,
    childrenClassName,
    backlit = true,
  }) => {
    return (
      <div
        className={cn(
          "rounded-[4px] p-[0.5px]", // Removed transform styles for simplicity, add back if needed
           backlit ? "bg-white/[0.2] shadow-xl shadow-white/10" : "bg-black/50" // Adjusted shadow
        )}
      >
        <div
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-[3.5px] bg-[#0A090D]",
             className
          )}
          style={{
            boxShadow:
              "0px -0.5px 2px 0 #0D0D0F inset, -0.5px 0px 2px 0 #0D0D0F inset",
          }}
        >
          <div
            className={cn(
              "flex w-full flex-col items-center justify-center text-[5px] font-medium text-neutral-200", // Slightly increased font size/weight
              childrenClassName,
               backlit && "text-white"
            )}
          >
            {children}
          </div>
        </div>
      </div>
    );
  };

  export const SpeakerGrid = () => {
    return (
      <div
        className="mt-2 flex h-40 gap-[2px] px-[0.5px]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #08080A 0.5px, transparent 0.5px)", // Slightly darker dots
          backgroundSize: "3px 3px",
        }}
      ></div>
    );
  };

  export const OptionKey = ({ className }) => {
    return (
      <svg
        fill="none"
        version="1.1"
        id="icon"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 32 32"
        className={className}
      >
        <rect stroke="currentColor" strokeWidth={2} x="18" y="5" width="10" height="2" />
        <polygon
          stroke="currentColor"
          strokeWidth={2}
          points="10.6,5 4,5 4,7 9.4,7 18.4,27 28,27 28,25 19.6,25 "
        />
        <rect
          id="_Transparent_Rectangle_"
          // className="st0" // Optional class if needed
          width="32"
          height="32"
          stroke="none"
        />
      </svg>
    );
  };

  const AceternityLogo = () => {
    // Using a simpler SVG or character for brevity if needed
    return (
      <svg
        width="66"
        height="65"
        viewBox="0 0 66 65"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-3 w-3 text-white" // Adjusted size
      >
        <path
          d="M8 8.05571C8 8.05571 54.9009 18.1782 57.8687 30.062C60.8365 41.9458 9.05432 57.4696 9.05432 57.4696"
          stroke="currentColor"
          strokeWidth="15" // Consider adjusting strokeWidth if size changes
          strokeMiterlimit="3.86874"
          strokeLinecap="round"
        />
      </svg>
    );
  };