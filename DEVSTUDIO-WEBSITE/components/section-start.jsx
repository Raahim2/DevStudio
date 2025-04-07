import React from 'react';
import PropTypes from 'prop-types';
import { TypingText } from './typing-text';
import { Button } from './capsule';

const SectionStart = ({
  typingWords,
  typingClassName = "text-2xl sm:text-3xl font-bold text-white",
  typingCursorClassName = "text-blue-400",
  buttonText,
  buttonProps = {},
  className = "",
}) => {
  return (
    <div className={`min-h-[50vh] flex flex-col items-center justify-center gap-6 text-white ${className}`}>
        {buttonText && (
        <Button
          className=" text-white px-6 py-2 rounded-full font-semibold"
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
