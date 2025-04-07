import React from 'react';
import PropTypes from 'prop-types';
import { TypingText } from './typing-text';
import { Button } from './capsule';

const SectionStart = ({
  typingWords,
  typingClassName = "text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white",
  typingCursorClassName = "text-blue-500 dark:text-blue-400",
  buttonText,
  buttonProps = {},
  className = "",
}) => {
  return (
    <div className={`min-h-[50vh] flex flex-col items-center justify-center gap-6 ${className}`}>
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

      <TypingText
        words={typingWords}
        className={typingClassName}
        cursorClassName={typingCursorClassName}
      />
    </div>
  );
};

SectionStart.propTypes = {
  typingWords: PropTypes.arrayOf(PropTypes.shape({
    text: PropTypes.string.isRequired,
    className: PropTypes.string,
  })).isRequired,
  typingClassName: PropTypes.string,
  typingCursorClassName: PropTypes.string,
  buttonText: PropTypes.string,
  buttonProps: PropTypes.object,
  className: PropTypes.string,
};

export default SectionStart;
