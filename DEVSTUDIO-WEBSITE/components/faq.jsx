import React from "react";

const FAQ = () => {
  const faqData = [
    {
      question: "Does DevStudio collect any data?",
      answer:
        "No, DevStudio is designed with privacy first. It does not collect your code, monitor your actions, or send data to external servers unless explicitly configured for specific integrations (like cloud deployments you initiate). Your core development work stays local on your machine.",
    },
    {
      question: "What are the minimum hardware / software requirements?",
      answer:
        "DevStudio is optimized for performance, but for the best experience with AI features, we recommend at least 8GB RAM (16GB+ preferred), a modern multi-core processor, and up-to-date versions of Node.js/npm (or relevant runtime for your projects). An active internet connection is required for initial setup and certain AI model interactions.",
    },
    {
      question: "What kind of models can I run?",
      answer:
        "DevStudio integrates with various state-of-the-art AI models for code generation, completion, debugging, and analysis. This includes large language models (LLMs) fine-tuned for code, and potentially specialized models for specific tasks. The exact models available may evolve over time.",
    },
    {
      question: "Is DevStudio open source?",
      answer:
        "Currently, DevStudio is a proprietary product. While we leverage many open-source technologies, the core platform itself is not open source at this time. We are exploring options for future community involvement.",
    },
    {
      question: "What is llama.cpp?", // Example placeholder
      answer:
        "llama.cpp is a popular open-source project focused on running Large Language Models (LLMs) efficiently on consumer hardware (CPU). DevStudio might utilize similar optimization techniques or libraries under the hood for local model execution, but it's a distinct platform.",
    },
    {
      question: "Can I use DevStudio at my company or organization?",
      answer:
        "Absolutely! We offer team and enterprise licenses designed for professional development environments, including features for collaboration, security, and centralized management. Please contact our sales team for more details on organizational use.",
    },
    {
      question: "Are you hiring?", // Example placeholder
      answer:
        "We are always looking for talented individuals passionate about the future of software development and AI! Check our Careers page for current openings.",
    },
  ];

  return (
    // Main container: Centered, max-width, padding for overall spacing
    <div className="w-full max-w-3xl mx-auto px-4 py-8 md:py-12">
      {/* Title */}
      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-center mb-4 text-gray-900 dark:text-white">
        Frequently Asked Questions
      </h2>

      {/* Subtitle / TLDR */}
      <p className="text-sm sm:text-base text-center text-neutral-600 dark:text-neutral-400 mb-8 md:mb-12">
        TLDR: The app prioritizes privacy; your data stays local unless you initiate external actions.
      </p>

      {/* FAQ List Container */}
      <div className="space-y-3"> {/* Adds vertical space between each FAQ item */}
        {faqData.map((item, index) => (
          <details
            key={index}
            className="group border-b border-neutral-200 dark:border-neutral-800 last:border-b-0 overflow-hidden"
             // Optional: add border between items if desired, removing space-y-3 if used
             // Using rounded background approach instead based on image
             // className="group bg-neutral-100 dark:bg-neutral-800/50 rounded-lg overflow-hidden transition-colors duration-300 hover:bg-neutral-200 dark:hover:bg-neutral-700/60"
          >
            <summary
              className="flex cursor-pointer list-none items-center justify-between p-4 md:p-5 font-medium text-gray-800 dark:text-gray-100 hover:bg-neutral-100 dark:hover:bg-neutral-800/70 transition-colors duration-200"
              // Style the summary like the button in the image
              // Use padding here for the clickable area text
              // bg-neutral-100 dark:bg-neutral-800 rounded-lg font-medium text-gray-800 dark:text-gray-100
            >
              <span>{item.question}</span>
              <span className="transition-transform duration-300 group-open:rotate-180">
                <svg
                  className="w-5 h-5 text-gray-600 dark:text-gray-400" // Adjusted size and color slightly
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  viewBox="0 0 24 24"
                >
                  <path d="M19 9l-7 7-7-7"></path> {/* Chevron down */}
                </svg>
              </span>
            </summary>

            {/* Answer Panel: Padding applied only when open */}
             <div className="px-4 md:px-5 pb-4 md:pb-5 pt-2 text-neutral-600 dark:text-neutral-300 text-sm sm:text-base leading-relaxed">
                 {/* Removed transition/animation classes - rely on default browser behavior or add JS if needed */}
                 {/* Add padding here */}
                 {item.answer}
             </div>
             {/* --- OR --- Use max-height transition (more complex but smoother) */}
            {/* <div
              className="overflow-hidden max-h-0 group-open:max-h-[500px] transition-[max-height] duration-500 ease-in-out" // Adjust max-h-[value] as needed
            >
              <p className="px-4 md:px-5 pb-4 md:pb-5 pt-2 text-neutral-600 dark:text-neutral-300 text-sm sm:text-base leading-relaxed">
                {item.answer}
              </p>
            </div> */}
          </details>
        ))}
      </div>
    </div>
  );
};

export default FAQ;