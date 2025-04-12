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
  sortTranslationsIntoInputGroup,
} from "./helpers/input-helpers.js";

const nhm = new NodeHtmlMarkdown(
  /* options (optional) */ {},
  /* customTransformers (optional) */ undefined,
  /* customCodeBlockTranslators (optional) */ undefined
);

export async function generateTranslationFiles(configData) {
  const locales = configData.locales;
  // Generate translation files for each locale
  for (let i = 0; i < locales.length; i++) {
    const locale = locales[i];

    await generateTranslationFilesForLocale(locale, configData).catch((err) => {
      console.error(`❌❌ Encountered an error translating ${locale}:`, err);
    });
  }
}

async function generateTranslationFilesForLocale(locale, configData) {
  const baseURL = configData.base_url;
  const baseFilePath = configData.rosey_paths.rosey_base_file_path;
  const baseURLFilePath = configData.rosey_paths.rosey_base_urls_file_path;
  const translationFilesDirPath = configData.rosey_paths.translations_dir_path;
  const incomingSmartlingTranslationsDir =
    configData.smartling.incoming_translations_dir;
  const smartlingTranslationsDataFilePath = path.join(
    incomingSmartlingTranslationsDir,
    `${locale}.json`
  );

  const baseFileData = await readJsonFromFile(baseFilePath);
  const baseURLFileData = await readJsonFromFile(baseURLFilePath);
  const smartlingTranslationData = await readJsonFromFile(
    smartlingTranslationsDataFilePath
  );

  // Get pages from the base.urls.json
  const baseUrlFileDataKeys = baseURLFileData.keys;
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
      initDefaultInputs(translationDataToWrite, page, locale, baseURL);
      // Process the url translation
      processUrlTranslation(translationFileData, translationDataToWrite, page);
      // Process the rest of the translations
      processTranslations(
        baseFileData,
        translationFileData,
        translationDataToWrite,
        smartlingTranslationData,
        baseURL,
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
}

function processUrlTranslation(
  translationFileData,
  translationDataToWrite,
  page
) {
  if (translationFileData.urlTranslation?.length > 0) {
    translationDataToWrite.urlTranslation = translationFileData.urlTranslation;
  } else {
    translationDataToWrite.urlTranslation = page;
  }
}

function processTranslations(
  baseFileData,
  translationFileData,
  translationDataToWrite,
  smartlingTranslationData,
  baseURL,
  page
) {
  // Loop through all the translations in the base.json
  Object.keys(baseFileData.keys).map((inputKey) => {
    const baseTranslationObj = baseFileData.keys[inputKey];

    // If translation doesn't exist on this page, exit early
    if (!baseTranslationObj.pages[page]) {
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
      baseURL
    );

    // Add each entry to page object group depending on whether they are already translated or not
    sortTranslationsIntoInputGroup(translationDataToWrite, inputKey);
  });
}
