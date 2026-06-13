import React, { createContext, ReactNode, useContext, useReducer } from 'react';

interface WizardData {
  phone: string;
  email: string;
  otp: string[];
  firstName: string;
  lastName: string;
  secondLastName: string;
  birthDate: string;
  gender: string;
  otherGender: string;
  street: string;
  exteriorNumber: string;
  interiorNumber: string;
  neighborhood: string;
  postalCode: string;
  city: string;
  state: string;
  password: string;
  confirmPassword: string;
  ineFront: any;
  ineBack: any;
}

interface SignupState {
  currentStep: number;
  wizardData: WizardData;
  errors: Partial<WizardData>;
  isLoading: boolean;
  language: string;
}

type SignupAction =
  | { type: 'SET_STEP'; payload: number }
  | { type: 'UPDATE_DATA'; payload: Partial<WizardData> }
  | { type: 'SET_ERRORS'; payload: Partial<WizardData> }
  | { type: 'CLEAR_ERROR'; payload: keyof WizardData }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_LANGUAGE'; payload: string }
  | { type: 'RESET_WIZARD' };

const initialState: SignupState = {
  currentStep: 1,
  wizardData: {
    phone: '',
    email: '',
    otp: ['', '', '', ''],
    firstName: '',
    lastName: '',
    secondLastName: '',
    birthDate: '',
    gender: '',
    otherGender: '',
    street: '',
    exteriorNumber: '',
    interiorNumber: '',
    neighborhood: '',
    postalCode: '',
    city: '',
    state: '',
    password: '',
    confirmPassword: '',
    ineFront: null,
    ineBack: null,
  },
  errors: {},
  isLoading: false,
  language: 'es-MX',
};

function signupReducer(state: SignupState, action: SignupAction): SignupState {
  switch (action.type) {
    case 'SET_STEP':
      return {
        ...state,
        currentStep: action.payload,
      };
    
    case 'UPDATE_DATA':
      return {
        ...state,
        wizardData: {
          ...state.wizardData,
          ...action.payload,
        },
      };
    
    case 'SET_ERRORS':
      return {
        ...state,
        errors: action.payload,
      };
    
    case 'CLEAR_ERROR':
      const newErrors = { ...state.errors };
      delete newErrors[action.payload];
      return {
        ...state,
        errors: newErrors,
      };
    
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    
    case 'SET_LANGUAGE':
      return {
        ...state,
        language: action.payload,
      };
    
    case 'RESET_WIZARD':
      return {
        ...initialState,
        language: state.language,
      };
    
    default:
      return state;
  }
}

interface SignupContextType {
  state: SignupState;
  dispatch: React.Dispatch<SignupAction>;
  updateWizardData: (field: keyof WizardData, value: any) => void;
  setStep: (step: number) => void;
  setErrors: (errors: Partial<WizardData>) => void;
  clearError: (field: keyof WizardData) => void;
  resetWizard: () => void;
}

const SignupContext = createContext<SignupContextType | undefined>(undefined);

export function SignupProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(signupReducer, initialState);

  const updateWizardData = (field: keyof WizardData, value: any) => {
    dispatch({ type: 'UPDATE_DATA', payload: { [field]: value } });
    // Clear error when user starts typing
    if (state.errors[field]) {
      dispatch({ type: 'CLEAR_ERROR', payload: field });
    }
  };

  const setStep = (step: number) => {
    dispatch({ type: 'SET_STEP', payload: step });
  };

  const setErrors = (errors: Partial<WizardData>) => {
    dispatch({ type: 'SET_ERRORS', payload: errors });
  };

  const clearError = (field: keyof WizardData) => {
    dispatch({ type: 'CLEAR_ERROR', payload: field });
  };

  const resetWizard = () => {
    dispatch({ type: 'RESET_WIZARD' });
  };

  const value: SignupContextType = {
    state,
    dispatch,
    updateWizardData,
    setStep,
    setErrors,
    clearError,
    resetWizard,
  };

  return (
    <SignupContext.Provider value={value}>
      {children}
    </SignupContext.Provider>
  );
}

export function useSignup() {
  const context = useContext(SignupContext);
  if (context === undefined) {
    throw new Error('useSignup must be used within a SignupProvider');
  }
  return context;
}
