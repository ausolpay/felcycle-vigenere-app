const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
let bruteForcePaused = false;
let bruteForceRunning = false;
let commonWords = [];
let extraWords = [];
let combinedWordList = [];
let combinedWordSet = new Set();
let startTime;

// Fetch the top 5000 common words
async function fetchCommonWords() {
  try {
    const response = await fetch("https://api.datamuse.com/words?ml=common&max=5000");
    const data = await response.json();
    commonWords = data.map((word) => word.word.toUpperCase());
    console.log("Fetched Common Words:", commonWords);
  } catch (error) {
    console.error("Error fetching common words:", error);
    commonWords = [];
  }
}

// Fetch extra words from `extra-words.js`
async function fetchExtraWords() {
  try {
    const script = document.createElement("script");
    script.src = "extra-words.js";
    document.head.appendChild(script);

    // Wait for script to load
    await new Promise((resolve) => {
      script.onload = resolve;
      script.onerror = () => {
        console.error("Error loading extra-words.js");
        resolve();
      };
    });

    console.log("Loaded Extra Words:", window.extraWords);
    extraWords = window.extraWords || [];
  } catch (error) {
    console.error("Error fetching extra words:", error);
    extraWords = [];
  }
}

// Combine word lists
function combineWordLists() {
  combinedWordList = [...new Set([...commonWords, ...extraWords])];
  console.log("Combined Word List:", combinedWordList);
  combinedWordSet = new Set(combinedWordList);
}

function createVigenereTable(removeDR, addZeroth, shiftBy20, startFrom20) {
  let alphabet = ALPHABET;
  if (removeDR) {
    alphabet = alphabet.replace("D", "").replace("R", "");
  }

  if (startFrom20) {
    alphabet = alphabet.slice(19) + alphabet.slice(0, 19);
  }

  if (shiftBy20) {
    alphabet = alphabet.slice(20) + alphabet.slice(0, 20);
  }

  const table = [];
  for (let i = 0; i < alphabet.length; i++) {
    table.push(alphabet.slice(i) + alphabet.slice(0, i));
  }
  if (addZeroth) {
    table.unshift(alphabet);
  }
  return table;
}

function decrypt(cipher, key, removeDR, addZeroth, shiftBy20, startFrom20) {
  const table = createVigenereTable(removeDR, addZeroth, shiftBy20, startFrom20);
  const alphabet = table[0];
  const result = [];
  const keyLength = key.length;

  for (let i = 0; i < cipher.length; i++) {
    const cipherChar = cipher[i];
    const keyChar = key[i % keyLength];
    const rowIndex = alphabet.indexOf(keyChar);
    const colIndex = table[rowIndex]?.indexOf(cipherChar);
    result.push(alphabet[colIndex]);
  }
  return result.join("");
}

const modeSwitch = document.getElementById("mode-switch");
modeSwitch.addEventListener("change", () => {
  if (modeSwitch.checked) {
    document.body.classList.remove("light-mode");
    document.body.classList.add("dark-mode");
  } else {
    document.body.classList.remove("dark-mode");
    document.body.classList.add("light-mode");
  }
});

function updateAnagramBox(key, decrypted, anagrams = []) {
  const anagramBox = document.getElementById("anagrams");
  if (anagrams.length > 0) {
    anagramBox.value += `${key} ${decrypted}\n${anagrams.join("\n")}\n\n`;
  } else {
    anagramBox.value += `(${key}) ${decrypted}\n`;
  }
  anagramBox.scrollTop = anagramBox.scrollHeight;
}

document.getElementById("add-anagram-input").addEventListener("click", () => {
  const manualInput = document.getElementById("manual-anagram-input");
  const anagramBox = document.getElementById("anagrams");

  const words = manualInput.value.trim();
  if (words) {
    anagramBox.value += (anagramBox.value.trim() ? "\n" : "") + words;
    anagramBox.scrollTop = anagramBox.scrollHeight;
    manualInput.value = "";
  } else {
    alert("Please enter some words before adding.");
  }
});

document.getElementById("generate-anagrams").addEventListener("click", () => {
  const anagramBox = document.getElementById("anagrams");
  const lines = anagramBox.value.trim().split("\n").filter((line) => line.trim() !== "");
  const anagramProgressBar = document.getElementById("anagram-progress");
  const anagramProgressText = document.getElementById("anagram-percentage");

  if (!lines.length) {
    alert("No input provided. Please enter text to generate anagrams.");
    return;
  }

  // Clear previous results
  anagramBox.value = "";

  anagramProgressBar.classList.add("loading-animation");
  anagramProgressBar.style.width = "0%";
  anagramProgressBar.style.transition = "none";
  anagramProgressText.textContent = "0% - Starting...";

  const isWordValid = (word) => combinedWordSet.has(word.toUpperCase());

  const generateAnagrams = (text) => {
    const resultSet = new Set();
    const generate = (prefix, remaining) => {
      if (remaining.length === 0) {
        if (isWordValid(prefix)) resultSet.add(prefix);
      } else {
        for (let i = 0; i < remaining.length; i++) {
          generate(prefix + remaining[i], remaining.slice(0, i) + remaining.slice(i + 1));
        }
      }
    };
    generate("", text);
    return Array.from(resultSet);
  };

  const isSubset = (word, text) => {
    const wordChars = word.split("");
    const textChars = text.split("");
    for (const char of wordChars) {
      const index = textChars.indexOf(char);
      if (index === -1) return false;
      textChars.splice(index, 1);
    }
    return true;
  };

  const removeChars = (text, word) => {
    let result = text;
    for (const char of word) {
      result = result.replace(char, "");
    }
    return result;
  };

  const generateMultiWordAnagrams = (text) => {
    const resultSet = new Set();
    const usedWords = new Set();

    const findAnagrams = (remainingText, currentWords) => {
      if (remainingText.length === 0 && currentWords.length > 1) {
        resultSet.add(currentWords.join(" "));
        return;
      }

      for (const word of combinedWordList) {
        if (!usedWords.has(word) && isSubset(word, remainingText)) {
          usedWords.add(word);
          findAnagrams(removeChars(remainingText, word), [...currentWords, word]);
          usedWords.delete(word);
        }
      }
    };

    findAnagrams(text, []);
    return Array.from(resultSet);
  };

  let currentIndex = 0;
  const batchSize = 5;
  let totalAnagramsCount = 0;
  let totalProcessedLines = 0;
  const allAnagrams = [];
  let linesFoundCount = 0;

  async function processBatch() {
    const newContent = [];

    for (let i = 0; i < batchSize && currentIndex < lines.length; i++, currentIndex++) {
      const line = lines[currentIndex];
      const [key, ...rest] = line.split(" ");
      const decrypted = rest.join(" ").trim();
      const anagrams = generateMultiWordAnagrams(decrypted.replace(/\s+/g, ""));

      totalProcessedLines++;

      if (anagrams.length > 0) {
        totalAnagramsCount += anagrams.length;
        allAnagrams.push(...anagrams);
        newContent.push({ key, decrypted, anagrams });
        linesFoundCount++;
      }
    }

    if (newContent.length > 0) {
      newContent.forEach(({ key, decrypted, anagrams }) => {
        updateAnagramBox(key, decrypted, anagrams);
      });
    }

    const progress = (currentIndex / lines.length) * 100;
    anagramProgressBar.style.width = `${progress}%`;
    anagramProgressBar.style.transition = "width 0.2s linear";
    anagramProgressText.textContent = `${Math.round(progress)}%`;

    await new Promise((resolve) => setTimeout(resolve, 10));

    if (currentIndex < lines.length) {
      setTimeout(processBatch, 50);
    } else {
      anagramProgressBar.classList.remove("loading-animation");
      anagramProgressBar.style.width = "100%";
      anagramProgressText.textContent = "100% - Complete!";

      const uniqueAnagrams = [...new Set(allAnagrams)];

      if (uniqueAnagrams.length === 0) {
        alert("No anagrams found.");
      } else {
        alert(`${linesFoundCount} keys found ${uniqueAnagrams.length} anagram words`);
      }
    }
  }

  processBatch();
});

document.getElementById("manual-solve").addEventListener("click", () => {
  const cipher = document.getElementById("cipher").value.toUpperCase();
  const key = document.getElementById("key").value.toUpperCase();
  const removeDR = document.getElementById("remove-d-r").checked;
  const addZeroth = document.getElementById("zeroth").checked;
  const shiftBy20 = document.getElementById("shift-by-20").checked;
  const startFrom20 = document.getElementById("start-from-20").checked;

  if (!cipher) {
    alert("Please enter a cipher word.");
    return;
  }
  if (!key) {
    alert("Please enter a key for manual solve.");
    return;
  }

  try {
    const decrypted = decrypt(cipher, key, removeDR, addZeroth, shiftBy20, startFrom20);
    const output = document.getElementById("output");
    output.value = `Key: ${key}, Decrypted: ${decrypted}`;
    output.scrollTop = output.scrollHeight;

  } catch (error) {
    console.error("Error during manual solve:", error);
    alert("An error occurred during manual solve. Please check your inputs.");
  }
});

function applyWildCard(wildCardKey, dynamicKey) {
  const leftKey = wildCardKey.left || "";
  const rightKey = wildCardKey.right || "";
  return leftKey + dynamicKey + rightKey;
}

// Restore partial key function to previous working logic
function generateKeyFunction(alphabet, partialKey, keyLength, wildCardKey) {
  return function(index) {
    const pLen = partialKey.length;
    const numPositions = keyLength - pLen + 1;
    const slots = keyLength - pLen;
    const base = Math.pow(alphabet.length, slots);
    const totalPossibleKeys = numPositions * base;

    const patternIndex = Math.floor(index / base);
    const remainder = index % base;

    const keyArray = new Array(keyLength).fill("*");
    for (let i = 0; i < pLen; i++) {
      keyArray[patternIndex + i] = partialKey[i];
    }

    const starPositions = [];
    for (let i = 0; i < keyArray.length; i++) {
      if (keyArray[i] === "*") {
        starPositions.push(i);
      }
    }

    let temp = remainder;
    for (let i = starPositions.length - 1; i >= 0; i--) {
      const pos = starPositions[i];
      keyArray[pos] = alphabet[temp % alphabet.length];
      temp = Math.floor(temp / alphabet.length);
    }

    return applyWildCard(wildCardKey, keyArray.join(""));
  };
}

// Brute Force with Dynamic Key Generation
async function bruteForce(
  cipher,
  removeDR,
  addZeroth,
  keyLength,
  filterRepeated,
  filterCommon,
  filterLettersRepeated,
  useWordListKeysOnly,
  useFourPlusWords,
  partialKey,
  wildCardKey,
  shiftBy20,
  startFrom20
) {
  bruteForceRunning = true;
  const table = createVigenereTable(removeDR, addZeroth, shiftBy20, startFrom20);
  const alphabet = table[0];
  const progressBar = document.getElementById("progress");
  const progressText = document.getElementById("percentage");
  const output = document.getElementById("output");
  const filteredKeysOutput = document.getElementById("filtered-keys-output");
  const filteredDecryptedOutput = document.getElementById("filtered-decrypted-output");
  const fourPlusResultsOutput = document.getElementById("four-plus-results-output");
  const fourPlusKeyResultsOutput = document.getElementById("four-plus-key-results-output");
  const multiWordResultsOutput = document.getElementById("multi-word-results-output");
  const fullWordResultsOutput = document.getElementById("full-word-results-output");
  const timeRemaining = document.getElementById("time-remaining");

  let totalKeys;
  let keysToSearch;

  if (useWordListKeysOnly) {
    keysToSearch = combinedWordList.filter((word) => word.length === keyLength);
    totalKeys = keysToSearch.length;
  } else if (useFourPlusWords) {
    keysToSearch = combinedWordList.filter((word) => word.length >= 4);
    totalKeys = keysToSearch.length;
  } else {
    const pLen = partialKey.length;
    const numPositions = keyLength - pLen + 1;
    const slots = keyLength - pLen;
    const base = Math.pow(alphabet.length, slots);
    totalKeys = numPositions * base;
  }

  let currentKeyIndex = 0;
  startTime = Date.now();

  let generateKey;
  if (useWordListKeysOnly || useFourPlusWords) {
    generateKey = (index) => keysToSearch[index];
  } else {
    generateKey = generateKeyFunction(alphabet, partialKey, keyLength, wildCardKey);
  }

  async function processBatch() {
    while (currentKeyIndex < totalKeys && bruteForceRunning) {
      if (bruteForcePaused) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }

      const key = generateKey(currentKeyIndex);
      const decrypted = decrypt(cipher, key, removeDR, addZeroth, shiftBy20, startFrom20);

      // Append to results
      output.value += `Key: ${key}, Decrypted: ${decrypted}\n`;
      output.scrollTop = output.scrollHeight;

      // Filtered Keys
      if (combinedWordList.some((word) => key.includes(word))) {
        filteredKeysOutput.value += `Key: ${key} (Decrypted: ${decrypted})\n`;
        filteredKeysOutput.scrollTop = filteredKeysOutput.scrollHeight;

        // 4+ Key Results
        const matchesKey = combinedWordList.some((word) => word.length >= 4 && key.includes(word));
        if (matchesKey) {
          fourPlusKeyResultsOutput.value += `Key: ${key} (Decrypted: ${decrypted})\n`;
          fourPlusKeyResultsOutput.scrollTop = fourPlusKeyResultsOutput.scrollHeight;
          updateAnagramBox(key, decrypted);
        }
      }

      // Filtered Decrypted
      if (combinedWordList.some((word) => decrypted.includes(word))) {
        filteredDecryptedOutput.value += `Decrypted: ${decrypted} (Key: ${key})\n`;
        filteredDecryptedOutput.scrollTop = filteredDecryptedOutput.scrollHeight;
      }

      // 4+ Word Results
      const matchesFourPlus = combinedWordList.filter((word) => word.length >= 4 && decrypted.includes(word));
      if (matchesFourPlus.length > 0) {
        fourPlusResultsOutput.value += `Decrypted: ${decrypted} (Key: ${key})\n`;
        fourPlusResultsOutput.scrollTop = fourPlusResultsOutput.scrollHeight;
      }

      // Multi-Word Results
      const findDistinctWords = (text, wordList) => {
        let remainingText = text.toUpperCase();
        const foundWords = [];

        for (const word of wordList) {
          const index = remainingText.indexOf(word.toUpperCase());
          if (index !== -1) {
            foundWords.push(word);
            remainingText = remainingText.slice(0, index) + remainingText.slice(index + word.length);
          }
        }

        return foundWords.length >= 2 ? foundWords : null;
      };

      const wordMatches = findDistinctWords(decrypted, combinedWordList);
      if (wordMatches) {
        multiWordResultsOutput.value += `Decrypted: ${decrypted} (Key: ${key})\nWords: ${wordMatches.join(", ")}\n`;
        multiWordResultsOutput.scrollTop = multiWordResultsOutput.scrollHeight;
      }

      // Full Word Results (8 characters)
      if (combinedWordList.some((word) => word.length === 8 && decrypted.includes(word))) {
        fullWordResultsOutput.value += `Decrypted: ${decrypted} (Key: ${key})\n`;
        fullWordResultsOutput.scrollTop = fullWordResultsOutput.scrollHeight;
      }

      // Update progress
      const progress = ((currentKeyIndex + 1) / totalKeys) * 100;
      document.getElementById("progress").style.width = `${progress}%`;
      document.getElementById("progress").style.transition = 'width 0.2s linear';
      document.getElementById("percentage").textContent = `${Math.round(progress)}%`;

      const elapsedTime = Date.now() - startTime;
      const estimatedTotalTime = (elapsedTime / (currentKeyIndex + 1)) * totalKeys;
      const remainingTime = estimatedTotalTime - elapsedTime;
      const hours = Math.floor(remainingTime / 3600000);
      const minutes = Math.floor((remainingTime % 3600000) / 60000);
      const seconds = Math.floor((remainingTime % 60000) / 1000);
      document.getElementById("time-remaining").textContent = `Estimated time remaining: ${hours}h ${minutes}m ${seconds}s`;

      await new Promise((resolve) => setTimeout(resolve, 0.01));

      currentKeyIndex++;
      if (currentKeyIndex % 100 === 0) await new Promise((r) => setTimeout(r, 0));
    }

    bruteForceRunning = false;
    if (!bruteForcePaused) alert("Brute force complete!");
  }

  document.getElementById("progress").style.width = "0%";
  document.getElementById("progress").style.transition = 'none';
  document.getElementById("percentage").textContent = "0% - Starting...";
  document.getElementById("time-remaining").textContent = "Estimated time remaining: Calculating...";
  await processBatch();
}

document.getElementById("reset-app").addEventListener("click", () => {
  bruteForcePaused = false;
  bruteForceRunning = false;
  document.getElementById("pause-resume").textContent = "Pause";
  document.getElementById("cipher").value = "";
  document.getElementById("key").value = "";
  document.getElementById("output").value = "";
  document.getElementById("filtered-keys-output").value = "";
  document.getElementById("filtered-decrypted-output").value = "";
  document.getElementById("four-plus-results-output").value = "";
  document.getElementById("four-plus-key-results-output").value = "";
  document.getElementById("multi-word-results-output").value = "";
  document.getElementById("full-word-results-output").value = "";
  document.getElementById("anagrams").value = "";
  document.getElementById("progress").style.width = "0%";
  document.getElementById("progress").style.transition = 'none';
  document.getElementById("percentage").textContent = "0%";
  document.getElementById("time-remaining").textContent = "";

  const checkboxes = document.querySelectorAll("input[type='checkbox']");
  checkboxes.forEach((checkbox) => {
    checkbox.checked = false;
  });

  document.getElementById("anagram-progress").style.width = "0%";
  document.getElementById("anagram-progress").style.transition = 'none';
  document.getElementById("anagram-percentage").textContent = "0%";
});

document.getElementById("pause-resume").addEventListener("click", () => {
  bruteForcePaused = !bruteForcePaused;
  document.getElementById("pause-resume").textContent = bruteForcePaused ? "Resume" : "Pause";
});

document.getElementById("brute-force").addEventListener("click", async () => {
  // If brute forcing is in progress and hasn't been paused, stop it first
  if (bruteForceRunning && !bruteForcePaused) {
    bruteForceRunning = false; // stop current brute force
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Reset states for a new run
  bruteForcePaused = false;
  bruteForceRunning = false;
  document.getElementById("pause-resume").textContent = "Pause";
  document.getElementById("progress").style.width = "0%";
  document.getElementById("progress").style.transition = 'none';
  document.getElementById("percentage").textContent = "0% - Starting...";

  const cipher = document.getElementById("cipher").value.toUpperCase();
  const removeDR = document.getElementById("remove-d-r").checked;
  const addZeroth = document.getElementById("zeroth").checked;
  const filterRepeated = document.getElementById("filter-repeated-keys").checked;
  const filterCommon = document.getElementById("filter-common-words").checked;
  const filterLettersRepeated = document.getElementById("filter-letters-repeated").checked;
  const useWordListKeysOnly = document.getElementById("use-word-list-keys-only").checked;
  const useFourPlusWords = document.getElementById("use-four-plus-words").checked;
  const keyLength = parseInt(document.getElementById("key-length").value, 10);
  const partialKey = document.getElementById("partial-key").value.toUpperCase();
  const wildCardKey = {
    left: document.getElementById("left-key").value.toUpperCase(),
    mid: document.getElementById("mid-key").value.toUpperCase(),
    right: document.getElementById("right-key").value.toUpperCase(),
  };
  const shiftBy20 = document.getElementById("shift-by-20").checked;
  const startFrom20 = document.getElementById("start-from-20").checked;

  if (!cipher) {
    alert("Please enter a cipher word.");
    return;
  }

  document.getElementById("output").value = "";
  document.getElementById("filtered-keys-output").value = "";
  document.getElementById("filtered-decrypted-output").value = "";
  document.getElementById("four-plus-results-output").value = "";
  document.getElementById("four-plus-key-results-output").value = "";
  document.getElementById("multi-word-results-output").value = "";
  document.getElementById("full-word-results-output").value = "";
  document.getElementById("anagrams").value = "";

  await bruteForce(
    cipher,
    removeDR,
    addZeroth,
    keyLength,
    filterRepeated,
    filterCommon,
    filterLettersRepeated,
    useWordListKeysOnly,
    useFourPlusWords,
    partialKey,
    wildCardKey,
    shiftBy20,
    startFrom20
  );
});

window.addEventListener("DOMContentLoaded", async () => {
  await fetchCommonWords();
  await fetchExtraWords();
  combineWordLists();
});
