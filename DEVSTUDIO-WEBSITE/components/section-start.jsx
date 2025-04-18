import React from 'react';
import { Button } from './capsule';

const SectionStart = ({
  buttonText,
  buttonProps = {},
  className = "",
}) => {
  return (
    <div className={`min-h-[30vh] flex flex-col items-center justify-center gap-6 ${className}`}>
      {buttonText && (
        <Button
          className={`px-6 py-2 rounded-full font-semibold transition-colors duration-200
                      bg-white text-gray-900 border border-gray-300 hover:bg-gray-100
                      dark:bg-neutral-800 dark:text-white dark:border-neutral-600 dark:hover:bg-neutral-700
                      ${buttonProps.className || ''}`}
          {...buttonProps}
        >
          {buttonText}
        </Button>
      )}

     
    </div>
  );
};


export default SectionStart;
