
import { TRANSLATIONS } from './translations';
try {
    console.log('EN edit:', TRANSLATIONS.en.edit);
    console.log('ZH edit:', TRANSLATIONS.zh.edit);
    console.log('Translations loaded successfully');
} catch (error) {
    console.error('Error loading translations:', error);
}
