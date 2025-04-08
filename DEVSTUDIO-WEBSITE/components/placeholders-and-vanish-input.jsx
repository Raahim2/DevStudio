"use client";

import { AnimatePresence, motion } from "motion/react"; // Assuming this is 'framer-motion' or similar
import { useCallback, useEffect, useRef, useState } from "react";
// Assuming cn utility is correctly set up (e.g., using tailwind-merge and clsx)
import { cn } from "../src/lib/utils"; // Make sure this path is correct

export function PlaceholdersAndVanishInput({
  placeholders,
  onChange,
  onSubmit,
}) {
  const [currentPlaceholder, setCurrentPlaceholder] = useState(0);
  const intervalRef = useRef(null);
  const inputRef = useRef(null);
  const canvasRef = useRef(null);
  const newDataRef = useRef([]);
  const [value, setValue] = useState("");
  const [animating, setAnimating] = useState(false);

  const startAnimation = useCallback(() => {
    // Don't restart if interval already exists
    if (intervalRef.current === null) {
      intervalRef.current = setInterval(() => {
        setCurrentPlaceholder((prev) => (prev + 1) % placeholders.length);
      }, 3000);
    }
  }, [placeholders.length]);

  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState !== "visible" && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    } else if (document.visibilityState === "visible") {
      startAnimation();
    }
  }, [startAnimation]);

  useEffect(() => {
    startAnimation();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [placeholders.length, startAnimation, handleVisibilityChange]); // Added dependencies

  const draw = useCallback(() => {
    if (!inputRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 800;
    ctx.clearRect(0, 0, 800, 800);
    const computedStyles = getComputedStyle(inputRef.current);

    const fontSize = parseFloat(computedStyles.getPropertyValue("font-size"));
    ctx.font = `${fontSize * 2}px ${computedStyles.fontFamily}`;
    // --- Get text color based on mode for canvas drawing ---
    // Check if dark mode is active on the input element itself or a parent
    const isDarkMode = document.documentElement.classList.contains('dark'); // Or check a specific parent
    // Use black text if dark mode (on white bg), white text if light mode (on dark bg)
    ctx.fillStyle = isDarkMode ? "#000" : "#FFF";
    // --------------------------------------------------------
    ctx.fillText(value, 16, 40);

    const imageData = ctx.getImageData(0, 0, 800, 800);
    const pixelData = imageData.data;
    const newData = [];

    for (let t = 0; t < 800; t++) {
      let i = 4 * t * 800;
      for (let n = 0; n < 800; n++) {
        let e = i + 4 * n;
        // Check alpha channel as well for actual drawn pixels
        if (pixelData[e + 3] > 0) { // Check alpha channel (pixelData[e+3])
          newData.push({
            x: n,
            y: t,
            // Use the determined fillStyle for particle color
            color: ctx.fillStyle,
          });
        }
      }
    }

    newDataRef.current = newData.map(({ x, y, color }) => ({
      x,
      y,
      r: 1, // Initial radius
      color: color, // Use the determined color string directly
    }));
  }, [value]); // Removed `draw` from its own dependency array

  useEffect(() => {
    // Draw whenever the value changes
    draw();
  }, [value, draw]);

  const animate = (start) => {
    const animateFrame = (pos = 0) => {
      requestAnimationFrame(() => {
        const newArr = [];
        for (let i = 0; i < newDataRef.current.length; i++) {
          const current = newDataRef.current[i];
          if (current.x < pos) {
            newArr.push(current);
          } else {
            if (current.r <= 0) {
              current.r = 0;
              continue;
            }
            current.x += Math.random() > 0.5 ? 1 : -1;
            current.y += Math.random() > 0.5 ? 1 : -1;
            current.r -= 0.05 * Math.random();
            newArr.push(current);
          }
        }
        newDataRef.current = newArr;
        const ctx = canvasRef.current?.getContext("2d");
        if (ctx) {
          ctx.clearRect(pos, 0, 800, 800);
          newDataRef.current.forEach((t) => {
            const { x: n, y: i, r: s, color: particleColor } = t;
            if (n > pos && s > 0) { // Only draw if radius > 0
              ctx.beginPath();
              ctx.rect(n, i, s, s); // Draw rect based on radius
              ctx.fillStyle = particleColor;
              // No need for stroke if fill is the same color and rect is small
              // ctx.strokeStyle = particleColor;
              // ctx.stroke();
              ctx.fill();
            }
          });
        }
        if (newDataRef.current.length > 0) {
          animateFrame(pos - 8);
        } else {
          setValue(""); // Clear input value
          setAnimating(false);
          inputRef.current?.focus(); // Optionally refocus after animation
        }
      });
    };
    animateFrame(start);
  };

  const vanishAndSubmit = useCallback(() => {
    if (animating) return; // Prevent re-triggering if already animating

    const currentValue = inputRef.current?.value || "";
    if (currentValue && inputRef.current) {
      setAnimating(true); // Set animating flag
      draw(); // Ensure canvas has the latest text drawn correctly
      const maxX = newDataRef.current.reduce(
        (prev, current) => (current.x > prev ? current.x : prev),
        0
      );
      animate(maxX);
      // onSubmit should likely be called here or after animation completes
      // depending on desired UX. Calling it here allows background processing.
      if (onSubmit) {
         onSubmit(currentValue); // Pass the value to the onSubmit handler
      }
    } else {
       // Handle case where Enter is pressed with no value?
       // Maybe just call onSubmit if provided?
       if (onSubmit) {
          onSubmit(currentValue);
       }
    }
  }, [animating, draw, onSubmit]); // Added dependencies

  const handleKeyDown = useCallback((e) => {
      if (e.key === "Enter" && !animating) {
        e.preventDefault(); // Prevent default form submission if needed
        vanishAndSubmit();
      }
    }, [animating, vanishAndSubmit] // Added dependencies
  );

  const handleSubmit = useCallback((e) => {
      e.preventDefault();
      vanishAndSubmit();
    }, [vanishAndSubmit] // Added dependency
  );


  return (
    <form
      className={cn(
        "w-full relative max-w-xl mx-auto bg-zinc-800 text-white dark:bg-white h-12 rounded-full overflow-hidden shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),_0px_1px_0px_0px_rgba(25,28,33,0.02),_0px_0px_0px_1px_rgba(25,28,33,0.08)] transition duration-200",
        // Consider if this override is needed, it complicates dark/light mode consistency
        // value && "bg-gray-50 dark:bg-gray-100" // Example: Ensure dark mode also gets a light bg when typing
        value && "bg-gray-50" // Original override
      )}
      onSubmit={handleSubmit}
    >
      {/* Canvas for vanishing effect */}
      <canvas
        className={cn(
          "absolute pointer-events-none text-base transform scale-50 top-[20%] left-2 sm:left-8 origin-top-left",
          // No invert needed if draw() uses correct color based on dark mode
          // "filter invert dark:invert-0",
          "transition-opacity duration-300", // Added transition for opacity
          !animating ? "opacity-0" : "opacity-100"
        )}
        ref={canvasRef}
        aria-hidden="true" // Hide from screen readers
      />

      {/* Input Field */}
      <input
        onChange={(e) => {
          if (!animating) {
            const newValue = e.target.value;
            setValue(newValue);
            onChange && onChange(e); // Forward the original event if needed
          }
        }}
        onKeyDown={handleKeyDown}
        ref={inputRef}
        value={value}
        type="text"
        // Removed placeholder attribute, handled by the animated div
        className={cn(
          "w-full relative text-sm sm:text-base z-50 border-none bg-transparent text-transparent caret-current", // Use transparent text color, caret will inherit from parent or use explicit color
          "h-full rounded-full focus:outline-none focus:ring-0 pl-4 sm:pl-10 pr-20",
           // --- Corrected Text Color based on form background ---
           // If form is dark (bg-zinc-800 default), text is white.
           // If form is light (dark:bg-white OR value && bg-gray-50), text is black.
          "text-white dark:text-black",
          value && "text-black", // Ensure text is black when bg-gray-50 is active

          // Make text truly transparent during animation, overriding above rules
          animating && "!text-transparent dark:!text-transparent caret-transparent"
        )}
      />

      {/* Submit Button */}
      <button
        disabled={!value || animating} // Disable button if no value OR animating
        type="submit"
        className="absolute right-2 top-1/2 z-50 -translate-y-1/2 h-8 w-8 rounded-full disabled:bg-gray-500 dark:disabled:bg-zinc-700 bg-black dark:bg-zinc-900 transition duration-200 flex items-center justify-center group focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-400 dark:focus:ring-offset-black"
        aria-label="Submit" // Accessibility
      >
        <motion.svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-gray-300 h-4 w-4 group-disabled:text-gray-400 dark:group-disabled:text-zinc-500"
        >
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <motion.path
            d="M5 12l14 0" // Arrow line
            initial={{
              strokeDasharray: "50%",
              strokeDashoffset: "50%",
            }}
            animate={{
              strokeDashoffset: value && !animating ? 0 : "50%", // Animate based on value and not animating
            }}
            transition={{
              duration: 0.3,
              ease: "linear",
            }}
          />
          <path d="M13 18l6 -6" /> {/* Arrow head top */}
          <path d="M13 6l6 6" /> {/* Arrow head bottom */}
        </motion.svg>
      </button>

      {/* Placeholder Animation Area */}
      <div
        className="absolute inset-0 flex items-center text-start rounded-full pointer-events-none z-40" // Ensure placeholder is behind input caret
        aria-hidden="true" // Hide from screen readers
      >
        <AnimatePresence mode="wait">
          {/* Show placeholder only when input is empty and not animating */}
          {!value && !animating && (
            <motion.p
              initial={{
                y: 5,
                opacity: 0,
              }}
              animate={{
                y: 0,
                opacity: 1,
              }}
              exit={{
                y: -15,
                opacity: 0,
              }}
              transition={{
                duration: 0.3,
                ease: "linear",
              }}
              // Key needs to be stable for the current placeholder to animate correctly
              key={`placeholder-${currentPlaceholder}`}
              className={cn(
                "absolute left-4 sm:left-10 text-sm sm:text-base font-normal w-[calc(100%-2rem)] truncate",
                // Placeholder color: Gray in light mode, lighter gray in dark mode
                "text-neutral-500 dark:text-zinc-500"
              )}
            >
              {placeholders[currentPlaceholder]}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
}