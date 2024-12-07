const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
let bruteForcePaused = false;
let bruteForceRunning = false;
let commonWords = [];
let extraWords = [];
let combinedWordList = [];
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

    // Wait for the script to load
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

// Combine the word lists
function combineWordLists() {
  combinedWordList = [...new Set([...commonWords, ...extraWords])];
  console.log("Combined Word List:", combinedWordList);
}

// Function to create the Vigenère table
function createVigenereTable(removeDR, addZeroth) {
  let alphabet = ALPHABET;
  if (removeDR) {
    alphabet = alphabet.replace("D", "").replace("R", "");
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

// Function to decrypt using a given key
function decrypt(cipher, key, removeDR, addZeroth) {
  const table = createVigenereTable(removeDR, addZeroth);
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

// Function to update Anagram Box
function updateAnagramBox(key, decrypted) {
  const anagramBox = document.getElementById("anagrams");
  anagramBox.value += `(${key}) ${decrypted}\n`;
  anagramBox.scrollTop = anagramBox.scrollHeight;
}

// Generate Anagrams with batching and throttling
document.getElementById("generate-anagrams").addEventListener("click", () => {
  const anagramBox = document.getElementById("anagrams");
  const lines = anagramBox.value.trim().split("\n").filter((line) => line.trim() !== "");
  const anagramProgressBar = document.getElementById("anagram-progress");
  const anagramProgressText = document.getElementById("anagram-percentage");

  anagramProgressBar.classList.add("loading-animation");

  const isWordValid = (word) => combinedWordList.includes(word.toUpperCase());

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

  let currentIndex = 0;
  const batchSize = 5;

  async function processBatch() {
    const newContent = [];
    let anyWordsGenerated = false;

    for (let i = 0; i < batchSize && currentIndex < lines.length; i++, currentIndex++) {
      const line = lines[currentIndex];
      const [key, ...rest] = line.split(" ");
      const decrypted = rest.join(" ").trim();
      const anagrams = generateMultiWordAnagrams(decrypted.replace(/\s+/g, ""));
      if (anagrams.length > 0) {
        newContent.push(`(${key}) ${decrypted}\n${anagrams.join(" \n")}`);
        anyWordsGenerated = true;
      }
    }

    if (anyWordsGenerated) {
      anagramBox.value += newContent.join("\n\n");
      anagramBox.scrollTop = anagramBox.scrollHeight;
    }

    // Update progress bar
    const progress = ((currentIndex) / lines.length) * 100;
    anagramProgressBar.style.width = `${progress}%`;
    anagramProgressBar.style.transition = 'width 0.2s linear';
    anagramProgressText.textContent = `${Math.round(progress)}%`;

    // Wait for the progress bar to apply the change
    await new Promise((resolve) => setTimeout(resolve, 0.01));

    // Update progress legend
    if (progress < 25) {
      anagramProgressText.textContent += " - Just getting started...";
    } else if (progress < 50) {
      anagramProgressText.textContent += " - Making progress!";
    } else if (progress < 75) {
      anagramProgressText.textContent += " - Over halfway there!";
    } else if (progress < 100) {
      anagramProgressText.textContent += " - Almost done!";
    } else {
      anagramProgressText.textContent += " - Complete!";
    }

    if (currentIndex < lines.length) {
      setTimeout(processBatch, 50); // Throttle to prevent freezing
    } else {
      anagramProgressBar.classList.remove("loading-animation");
      anagramProgressBar.style.width = "100%";
      anagramProgressText.textContent = "100% - Complete!";
      if (!anyWordsGenerated) {
        alert("No anagrams were found.");
      } else {
        alert(`Anagrams generation complete. ${newContent.length} anagram(s) found.`);
      }
    }
  }

  anagramProgressBar.style.width = "0%";
  anagramProgressBar.style.transition = 'none';
  anagramProgressText.textContent = "0% - Starting...";
  processBatch();
});

// Manual Solve Button
document.getElementById("manual-solve").addEventListener("click", () => {
  const cipher = document.getElementById("cipher").value.toUpperCase();
  const key = document.getElementById("key").value.toUpperCase();
  const removeDR = document.getElementById("remove-d-r").checked;
  const addZeroth = document.getElementById("zeroth").checked;

  if (!cipher) {
    alert("Please enter a cipher word.");
    return;
  }
  if (!key) {
    alert("Please enter a key for manual solve.");
    return;
  }

  try {
    const decrypted = decrypt(cipher, key, removeDR, addZeroth);
    const output = document.getElementById("output");
    output.value = `Key: ${key}, Decrypted: ${decrypted}`;
    output.scrollTop = output.scrollHeight;

  } catch (error) {
    console.error("Error during manual solve:", error);
    alert("An error occurred during manual solve. Please check your inputs.");
  }
});

// Adjust wildcard application logic
function applyWildCard(wildCardKey, dynamicKey) {
  const leftKey = wildCardKey.left || "";
  const rightKey = wildCardKey.right || "";
  return leftKey + dynamicKey + rightKey;
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
  wildCardKey
) {
  bruteForceRunning = true;
  const alphabet = createVigenereTable(removeDR, addZeroth)[0];
  const progressBar = document.getElementById("progress");
  const progressText = document.getElementById("percentage");
  const output = document.getElementById("output");
  const filteredKeysOutput = document.getElementById("filtered-keys-output");
  const filteredDecryptedOutput = document.getElementById("filtered-decrypted-output");
  const fourPlusResultsOutput = document.getElementById("four-plus-results-output");
  const fourPlusKeyResultsOutput = document.getElementById("four-plus-key-results-output");
  const multiWordResultsOutput = document.getElementById("multi-word-results-output");
  const fullWordResultsOutput = document.getElementById("full-word-results-output");
  const anagramBox = document.getElementById("anagrams");
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
    totalKeys = Math.pow(alphabet.length, keyLength - (partialKey ? partialKey.length : 0));
  }

  let currentKeyIndex = 0;
  startTime = Date.now();

  function generateKey(index) {
    const keyArray = partialKey.padEnd(keyLength, "*").split("");

    for (let i = 0; i < keyArray.length; i++) {
      if (keyArray[i] === "*") {
        keyArray[i] = alphabet[Math.floor(index / Math.pow(alphabet.length, i)) % alphabet.length];
      }
    }

    return applyWildCard(wildCardKey, keyArray.join(""));
  }

  async function processBatch() {
    while (currentKeyIndex < totalKeys && bruteForceRunning) {
      if (bruteForcePaused) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }

      const keys = useWordListKeysOnly || useFourPlusWords ? [keysToSearch[currentKeyIndex]] : [generateKey(currentKeyIndex)];
      for (const key of keys) {
        const decrypted = decrypt(cipher, key, removeDR, addZeroth);

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

        // Filtered Decrypted Results
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

          // Full Word Results (8+ characters from list)
          if (combinedWordList.some((word) => word.length === 8 && decrypted.includes(word))) {
            fullWordResultsOutput.value += `Decrypted: ${decrypted} (Key: ${key})\n`;
            fullWordResultsOutput.scrollTop = fullWordResultsOutput.scrollHeight;
          }
        }

      // Update progress bar after each batch
      const progress = ((currentKeyIndex + 1) / totalKeys) * 100;
      progressBar.style.width = `${progress}%`;
      progressBar.style.transition = 'width 0.2s linear';
      progressText.textContent = `${Math.round(progress)}%`;
      let currentLegend = progressText.textContent.split(' - ')[1] || '';

      // Calculate and update estimated time remaining
      const elapsedTime = Date.now() - startTime;
      const estimatedTotalTime = (elapsedTime / (currentKeyIndex + 1)) * totalKeys;
      const remainingTime = estimatedTotalTime - elapsedTime;
      const hours = Math.floor(remainingTime / 3600000);
      const minutes = Math.floor((remainingTime % 3600000) / 60000);
      const seconds = Math.floor((remainingTime % 60000) / 1000);
      timeRemaining.textContent = `Estimated time remaining: ${hours}h ${minutes}m ${seconds}s`;

      // Wait for the progress bar to apply the change
      await new Promise((resolve) => setTimeout(resolve, 0.01));

      // Update progress legend
      if (progress < 25) {
        progressText.textContent = `${Math.round(progress)}% - Just getting started...`;
      } else if (progress < 50) {
        progressText.textContent = `${Math.round(progress)}% - Making progress!`;
      } else if (progress < 75) {
        progressText.textContent = `${Math.round(progress)}% - Over halfway there!`;
      } else if (progress < 100) {
        progressText.textContent = `${Math.round(progress)}% - Almost finished!`;
      } else {
        progressText.textContent = `${Math.round(progress)}% - Complete!`;
      }

      currentKeyIndex++;
      if (currentKeyIndex % 100 === 0) await new Promise((r) => setTimeout(r, 0)); // Yield to the browser
    }

    bruteForceRunning = false;
    if (!bruteForcePaused) alert("Brute force complete!");
  }

  progressBar.style.width = "0%";
  progressBar.style.transition = 'none';
  progressText.textContent = "0% - Starting...";
  timeRemaining.textContent = "Estimated time remaining: Calculating...";
  await processBatch();
}

// Reset the App
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
});

// Pause/Resume Brute Force
document.getElementById("pause-resume").addEventListener("click", () => {
  bruteForcePaused = !bruteForcePaused;
  document.getElementById("pause-resume").textContent = bruteForcePaused ? "Resume" : "Pause";
});

// Brute Force Button
document.getElementById("brute-force").addEventListener("click", async () => {
  if (bruteForceRunning) return alert("Brute force is already running!");

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

  if (!cipher) {
    alert("Please enter a cipher word.");
    return;
  }

  document.getElementById("progress").style.width = "0%";
  document.getElementById("percentage").textContent = "0% - Starting...";
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
    wildCardKey
  );
});

// Fetch common words and extra words on load
window.addEventListener("DOMContentLoaded", async () => {
  await fetchCommonWords();
  await fetchExtraWords();
  combineWordLists();
});
