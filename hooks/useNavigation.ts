import { useAppContext } from '../contexts/FirebaseAppContext';
import { dispatchBackIntercept } from '../utils/mobileBack';

export const useNavigation = () => {
  const {
    navigateBack,
    canNavigateBack,
  } = useAppContext();

  const requestBack = () => {
    if (dispatchBackIntercept('button')) {
      return true;
    }

    return navigateBack();
  };

  return {
    navigateBack,
    canNavigateBack,
    requestBack,
  };
};
