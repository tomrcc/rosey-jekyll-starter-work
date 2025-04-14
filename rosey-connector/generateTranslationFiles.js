import fs from "fs";
import YAML from "yaml";
import path from "path";
import { NodeHtmlMarkdown } from "node-html-markdown";
import {
  readJsonFromFile,
  readYamlFromFile,
  removeOldTranslationFiles,
  getYamlFileName,
  createParentDirIfExists,
} from "./helpers/file-helpers.js";
import {
  initDefaultInputs,
  getInputConfig,
  initCommonPageInputs,
  getCommonInputConfig,
  sortTranslationIntoInputGroup,
} from "./helpers/input-helpers.js";

const nhm = new NodeHtmlMarkdown(
  /* options (optional) */ {},
  /* customTransformers (optional) */ undefined,
  /* customCodeBlockTranslators (optional) */ undefined
);

export async function generateTranslationFiles(configData) {
  // Get all the config data
  const locales = configData.locales;
  const baseUrl = configData.base_url;
  const baseFilePath = configData.rosey_paths.rosey_base_file_path;
  const baseUrlFilePath = configData.rosey_paths.rosey_base_urls_file_path;
  const translationFilesDirPath = configData.rosey_paths.translations_dir_path;
  const incomingSmartlingTranslationsDir =
    configData.smartling.incoming_translations_dir;

  // Get the base.json and base.urls.json
  const baseFileData = await readJsonFromFile(baseFilePath);
  const baseUrlFileData = await readJsonFromFile(baseUrlFilePath);

  // Generate translation files for each locale
  for (let i = 0; i < locales.length; i++) {
    const locale = locales[i];

    await generateTranslationFilesForLocale(
      locale,
      baseUrl,
      baseFileData,
      baseUrlFileData,
      translationFilesDirPath,
      incomingSmartlingTranslationsDir
    ).catch((err) => {
      console.error(`❌❌ Encountered an error translating ${locale}:`, err);
    });
  }
}

async function generateTranslationFilesForLocale(
  locale,
  baseUrl,
  baseFileData,
  baseUrlFileData,
  translationFilesDirPath,
  incomingSmartlingTranslationsDir
) {
  // Get pages from the base.urls.json
  const baseUrlFileDataKeys = baseUrlFileData.keys;
  const pages = Object.keys(baseUrlFileDataKeys);

  // Make sure there is a directory for the translation files to go in
  const translationsLocalePath = path.join(translationFilesDirPath, locale);
  await fs.promises.mkdir(translationsLocalePath, { recursive: true });

  // Get current translation files
  const translationsFiles = await fs.promises.readdir(translationsLocalePath, {
    recursive: true,
  });

  // Remove translations pages no longer present in the base.json file
  await removeOldTranslationFiles(
    translationsFiles,
    translationsLocalePath,
    baseUrlFileDataKeys,
    pages
  );

  // Get Smartling data if any exists
  const smartlingTranslationsDataFilePath = path.join(
    incomingSmartlingTranslationsDir,
    `${locale}.json`
  );
  // Fallback of empty object
  const smartlingTranslationData = await readJsonFromFile(
    smartlingTranslationsDataFilePath
  );

  // Loop through the pages present in the base.json
  await Promise.all(
    pages.map(async (page) => {
      const translationDataToWrite = {};

      // Get the path of the equivalent translation page to the base.json one we're on
      const yamlPageName = getYamlFileName(page);
      const translationFilePath = path.join(
        translationFilesDirPath,
        locale,
        `${yamlPageName}.yaml`
      );
      // Ensure nested translation pages have parent directory
      await createParentDirIfExists(
        yamlPageName,
        translationFilesDirPath,
        locale
      );

      // Get existing translation page data, returns a fallback if none exists
      const translationFileData = await readYamlFromFile(translationFilePath);
      // Set up inputs for the page if none exist already
      initDefaultInputs(translationDataToWrite, page, locale, baseUrl);
      // Process the url translation
      processUrlTranslation(translationFileData, translationDataToWrite, page);
      // Process the rest of the translations
      // TODO: As part of process translations, look for keys with common at the start and
      // add them to common array
      // Don't write them to the translation file
      processTranslations(
        baseFileData,
        translationFileData,
        translationDataToWrite,
        smartlingTranslationData,
        baseUrl,
        page
      );

      // Write the file back once we've processed the translations
      await fs.promises.writeFile(
        translationFilePath,
        YAML.stringify(translationDataToWrite)
      );
      console.log(
        `Translation file: ${translationFilePath} updated succesfully`
      );
    })
  );

  // TODO: After the pages are done looping and writing, write an extra 'common' file
  const commonFilePath = path.join(
    translationFilesDirPath,
    locale,
    "common.yaml"
  );

  // Get the existing common file translations
  const existingCommonFileData = await readYamlFromFile(commonFilePath); // Falls back to empty `inputs:` obj

  // Loop through the existing keys again
  const commonTranslationDataToWrite = {};
  initCommonPageInputs(commonTranslationDataToWrite, locale);

  await Promise.all(
    Object.keys(baseFileData.keys).map(async (inputKey) => {
      if (!inputKey.startsWith("common:")) {
        return;
      }
      const baseTranslationObj = baseFileData.keys[inputKey];

      // If they exist on the page already, preserve the translation
      if (existingCommonFileData[inputKey]) {
        commonTranslationDataToWrite[inputKey] =
          existingCommonFileData[inputKey];
      } else {
        // Otherwise add them to the common page with their
        commonTranslationDataToWrite[inputKey] = "";
      }

      // Set up inputs for each key
      commonTranslationDataToWrite._inputs[inputKey] = getCommonInputConfig(
        inputKey,
        baseTranslationObj
      );

      // Add each entry to page object group depending on whether they are already translated or not
      sortTranslationIntoInputGroup(commonTranslationDataToWrite, inputKey);
    })
  );

  // Write the file back once we've processed the translations
  await fs.promises.writeFile(
    commonFilePath,
    YAML.stringify(commonTranslationDataToWrite)
  );
  console.log(`Translation file: ${commonFilePath} updated succesfully`);
}

function processUrlTranslation(
  translationFileData,
  translationDataToWrite,
  page
) {
  const existingUrlTranslation = translationFileData.urlTranslation;
  if (existingUrlTranslation?.length > 0) {
    translationDataToWrite.urlTranslation = existingUrlTranslation;
  } else {
    translationDataToWrite.urlTranslation = page;
  }
}

function processTranslations(
  baseFileData,
  translationFileData,
  translationDataToWrite,
  smartlingTranslationData,
  baseUrl,
  page
) {
  // Loop through all the translations in the base.json
  Object.keys(baseFileData.keys).map((inputKey) => {
    const baseTranslationObj = baseFileData.keys[inputKey];

    // If translation doesn't exist on this page, exit early
    if (!baseTranslationObj.pages[page]) {
      return;
    }
    // Check for namespace of common and exit early since this translation key belongs to the common page, not each individual page
    if (inputKey.startsWith("common:")) {
      return;
    }

    // Only add the key to our output data if it still exists in base.json
    if (translationFileData[inputKey]) {
      translationDataToWrite[inputKey] = translationFileData[inputKey];
    }

    // If entry doesn't exist in our output file but exists in the base.json, add it
    // Check Smartling translations for the translation and add it here if it exists
    // We only need to check Smartling for new translations
    if (!translationDataToWrite[inputKey]) {
      if (smartlingTranslationData[inputKey]) {
        translationDataToWrite[inputKey] = nhm.translate(
          smartlingTranslationData[inputKey]
        );
      } else {
        translationDataToWrite[inputKey] = "";
      }
    }

    // Set up inputs for each key
    translationDataToWrite._inputs[inputKey] = getInputConfig(
      inputKey,
      page,
      baseTranslationObj,
      baseUrl
    );

    // Add each entry to page object group depending on whether they are already translated or not
    sortTranslationIntoInputGroup(translationDataToWrite, inputKey);
  });
}
