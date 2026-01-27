import { useState, useEffect } from 'react';
import { debounce } from '../utils/debounce';

interface ValidationResult {
  isValid: boolean;
  count: number;
  status: 'validating' | 'valid' | 'invalid' | 'error' | 'multiple';
  message: string;
}

export function useSelectorValidation(selector: string) {
  const [validation, setValidation] = useState<ValidationResult>({
    isValid: false,
    count: 0,
    status: 'validating',
    message: '',
  });

  useEffect(() => {
    if (!selector || selector.trim() === '') {
      setValidation({
        isValid: false,
        count: 0,
        status: 'invalid',
        message: 'Enter a selector',
      });
      return;
    }

    const validateSelector = debounce(async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
          setValidation({
            isValid: false,
            count: 0,
            status: 'error',
            message: 'No active tab',
          });
          return;
        }

        // Ensure content script is loaded before validation
        let response;
        try {
          response = await chrome.tabs.sendMessage(tab.id, {
            type: 'selector:validate',
            selector,
          });
        } catch (error) {
          // Content script not loaded, try to inject it
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js'],
            });
            await new Promise((r) => setTimeout(r, 300));

            // Try validation again
            response = await chrome.tabs.sendMessage(tab.id, {
              type: 'selector:validate',
              selector,
            });
          } catch (injectError) {
            setValidation({
              isValid: false,
              count: 0,
              status: 'error',
              message: 'Content script not available',
            });
            return;
          }
        }

        if (!response) {
          setValidation({
            isValid: false,
            count: 0,
            status: 'error',
            message: 'Cannot validate',
          });
          return;
        }

        if (response.count === 0) {
          setValidation({
            isValid: false,
            count: 0,
            status: 'invalid',
            message: 'No elements found',
          });
        } else if (response.count === 1) {
          setValidation({
            isValid: true,
            count: 1,
            status: 'valid',
            message: `Found: ${response.element?.tag || 'element'}`,
          });
        } else {
          setValidation({
            isValid: true,
            count: response.count,
            status: 'multiple',
            message: `${response.count} elements found`,
          });
        }
      } catch (error) {
        setValidation({
          isValid: false,
          count: 0,
          status: 'error',
          message: 'Validation error',
        });
      }
    }, 500);

    validateSelector();

    return () => {
      validateSelector.cancel?.();
    };
  }, [selector]);

  return validation;
}
