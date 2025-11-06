import { FeaturePageMap } from './menuConfig';
import HomePage from '../pages/HomePage';
import StatisticsOverviewPage from '../pages/StatisticsOverviewPage';
import StatisticsDetailPage from '../pages/StatisticsDetailPage';
import SettingsGeneralPage from '../pages/SettingsGeneralPage';
import SettingsAdvancedPage from '../pages/SettingsAdvancedPage';

// Feature 和 Page 的映射关系
export const featurePageMap: FeaturePageMap = {
  home: {
    default: HomePage,
  },
  statistics: {
    overview: StatisticsOverviewPage,
    detail: StatisticsDetailPage,
  },
  settings: {
    general: SettingsGeneralPage,
    advanced: SettingsAdvancedPage,
  },
};

