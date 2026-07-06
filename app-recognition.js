/**
 * Version 2: Successive Recognition Task (with Supabase Integration)
 */

// --- CONFIGURATION: IMAGE LURE/TARGET LOOKUP TABLE ---
// Define whether each artwork is actually in the exhibition (true) or is a lure (false).
// Once you gather all your images, you can map them by their image URL/filename.
function isExhibitionArtwork(art) {
  if (!art || !art.image_url) return false;

  if (art.image_url.startsWith('assets/Real/')) {
    return true;
  }

  if (art.image_url.startsWith('assets/Lure/')) {
    return false;
  }

  // Test trials: determine by image_type property
  if (art.image_url.startsWith('test_trials/')) {
    return art.image_type === true;
  }

  return true; // fallback
}

async function startExperiment() {
  const jsPsych = initJsPsych({
    override_safe_mode: true,
    on_finish: async function () {
      // Gather data: we have recognition tasks, and some timeline tasks.
      // We will loop through the recognition tasks, and for those that are recognized,
      // we'll get the following timeline task data and combine them.
      const rawData = jsPsych.data.get().values();

      const combinedData = [];
      artworks.forEach((art, index) => {
        // Find recognition and timeline trials for this artwork
        const confTrial = rawData.find(t => t.trial_type === 'recognition-task' && t.recognition_confidence !== null && t.artwork_index === index);
        const durTrial = rawData.find(t => t.trial_type === 'recognition-task' && t.relative_duration !== null && t.artwork_index === index);
        const timeTrial = rawData.find(t => t.trial_type === 'timeline-task' && t.artwork_index === index);

        const recognized = confTrial ? confTrial.recognized : false;

        combinedData.push({
          artwork_index: index,
          image_id: art.image_url,
          recognized: recognized,
          recognition_confidence: confTrial ? confTrial.recognition_confidence : null,
          relative_duration: durTrial ? durTrial.relative_duration : null,
          rt_recognition: confTrial ? confTrial.rt_recognition : null,
          rt_phase2: durTrial ? durTrial.rt_recognition : null,
          timeline_position_sec: timeTrial ? timeTrial.timeline_position_sec : null,
          estimated_duration_sec: timeTrial ? timeTrial.estimated_duration_sec : null,
          rt_timeline: timeTrial ? timeTrial.rt_recognition : null
        });
      });

      // 1. Extract participant info from initial trials
      let participantId = 'P-' + Math.random().toString(36).substr(2, 9).toUpperCase(); // fallback
      let sessionDate = new Date().toISOString().split('T')[0]; // fallback
      let raName = 'N/A'; // fallback

      for (const trial of rawData) {
        if (trial.participant_id !== undefined && trial.artwork_index === undefined) {
          participantId = trial.participant_id;
        }
        if (trial.session_date !== undefined) {
          sessionDate = trial.session_date;
        }
        if (trial.ra_name !== undefined) {
          raName = trial.ra_name;
        }
      }

      // Match cued recall responses
      for (const item of combinedData) {
        const recallTrial = rawData.find(trial => 
          trial.trial_type === 'cued-recall-task' && 
          trial.artwork_index === item.artwork_index
        );
        item.cued_recall_response = recallTrial ? recallTrial.cued_recall_response : '';
      }

      // 2. Log data (Flat Row format)
      document.body.innerHTML = '<div class="summary-container"><p>Saving results...</p></div>';

      // Add metadata to every single trial so they are on every row of the CSV!
      jsPsych.data.addProperties({
        participant_id: participantId,
        session_date: sessionDate,
        ra_name: raName
      });

      // Create CSV Download Logic
      window.downloadCSV = function () {
        const rawData = jsPsych.data.get().values();
        const formattedRows = [];
        let indexCounter = 0;

        rawData.forEach((trial) => {
          const hasArtIndex = trial.artwork_index !== undefined && trial.artwork_index !== null;
          const art = hasArtIndex ? artworks[trial.artwork_index] : null;
          const isTarget = art ? isExhibitionArtwork(art) : null;
          const image_type = art ? (isTarget ? 'TRUE' : 'FALSE') : null;

          let correct = null;
          if (art) {
            const recognizedTrialForArt = rawData.find(t => 
              t.trial_type === 'recognition-task' && 
              t.recognition_confidence !== null && 
              t.artwork_index === trial.artwork_index
            );
            if (recognizedTrialForArt) {
              correct = (recognizedTrialForArt.recognized === isTarget) ? 'TRUE' : 'FALSE';
            }
          }

          if (trial.trial_type === 'participant-id-input' || 
              trial.trial_type === 'session-date-input' || 
              trial.trial_type === 'ra-name-input' ||
              trial.trial_type === 'wait-for-start' ||
              trial.trial_type === 'completion-instruction') {
            
            // Keep setup/instruction trials as a single row
            formattedRows.push({
              ...trial,
              trial_index: indexCounter++
            });

          } else if (trial.trial_type === 'recognition-task') {
            if (trial.recognition_confidence !== null && trial.recognition_confidence !== undefined) {
              // 1. Begin Row
              formattedRows.push({
                participant_id: participantId,
                session_date: sessionDate,
                ra_name: raName,
                trial_type: 'Recognition_begin',
                trial_index: indexCounter++,
                time_elapsed: trial.time_elapsed - trial.rt,
                rt: null,
                stimulus: trial.stimulus,
                image_id: trial.image_id,
                image_type: image_type,
                correct: correct,
                internal_node_id: trial.internal_node_id
              });
              // 2. Response Row
              formattedRows.push({
                ...trial,
                trial_type: 'Recognition_response',
                trial_index: indexCounter++,
                image_type: image_type,
                correct: correct
              });
            } else if (trial.relative_duration !== null && trial.relative_duration !== undefined) {
              // 1. Begin Row
              formattedRows.push({
                participant_id: participantId,
                session_date: sessionDate,
                ra_name: raName,
                trial_type: 'Duration_begin',
                trial_index: indexCounter++,
                time_elapsed: trial.time_elapsed - trial.rt,
                rt: null,
                stimulus: trial.stimulus,
                image_id: trial.image_id,
                image_type: image_type,
                correct: correct,
                internal_node_id: trial.internal_node_id
              });
              // 2. Response Row
              formattedRows.push({
                ...trial,
                trial_type: 'Duration_response',
                trial_index: indexCounter++,
                image_type: image_type,
                correct: correct
              });
            }
          } else if (trial.trial_type === 'timeline-task') {
            // 1. Begin Row
            formattedRows.push({
              participant_id: participantId,
              session_date: sessionDate,
              ra_name: raName,
              trial_type: 'Timeline_begin',
              trial_index: indexCounter++,
              time_elapsed: trial.time_elapsed - trial.rt,
              rt: null,
              stimulus: trial.stimulus,
              image_id: trial.image_id,
              image_type: image_type,
              correct: correct,
              internal_node_id: trial.internal_node_id
            });
            // 2. Response Row
            formattedRows.push({
              ...trial,
              trial_type: 'Timeline_response',
              trial_index: indexCounter++,
              image_type: image_type,
              correct: correct
            });
          } else if (trial.trial_type === 'cued-recall-task') {
            // 1. Begin Row
            formattedRows.push({
              participant_id: participantId,
              session_date: sessionDate,
              ra_name: raName,
              trial_type: 'cuedRecall_begin',
              trial_index: indexCounter++,
              time_elapsed: trial.time_elapsed - trial.rt,
              rt: null,
              stimulus: trial.stimulus,
              image_id: trial.image_id,
              image_type: image_type,
              correct: correct,
              artwork_index: trial.artwork_index,
              internal_node_id: trial.internal_node_id
            });
            // 2. Response Row
            formattedRows.push({
              ...trial,
              trial_type: 'cuedRecall_response',
              trial_index: indexCounter++,
              image_type: image_type,
              correct: correct
            });
          }
        });

        // Convert formattedRows to CSV
        const headers = [
          'trial_index', 'trial_type', 'time_elapsed', 'rt', 'stimulus', 'response',
          'participant_id', 'session_date', 'ra_name', 'image_id', 'image_type',
          'recognized', 'correct', 'recognition_confidence', 'relative_duration',
          'rt_recognition', 'rt_phase2', 'timeline_position_sec', 'estimated_duration_sec',
          'rt_timeline', 'artwork_index', 'cued_recall_response'
        ];

        let csvContent = headers.join(',') + '\n';
        formattedRows.forEach(row => {
          let rowValues = headers.map(header => {
            let val = row[header];
            if (val === undefined || val === null) {
              return '';
            }
            let valString = String(val).replace(/"/g, '""');
            if (valString.includes(',') || valString.includes('"') || valString.includes('\n')) {
              return `"${valString}"`;
            }
            return valString;
          });
          csvContent += rowValues.join(',') + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", participantId + '_capture_data.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };

      // Automatically download the CSV
      window.downloadCSV();

      // 3. Show Completion Screen
      let summaryHtml = `
        <div class="summary-container">
          <h1>Tour Summary</h1>
          <p>Results saved successfully and downloaded to your computer.</p>
          <p style="margin-top: 20px; margin-bottom: 5px; font-size: 1.1rem;">Participant ID: <strong>${participantId}</strong></p>
          <p style="margin-bottom: 5px; font-size: 1.1rem;">Date: <strong>${sessionDate}</strong></p>
          <p style="margin-bottom: 40px; font-size: 1.1rem;">RA Name: <strong>${raName}</strong></p>
          <div style="display: flex; justify-content: center;">
            <a href="index.html" class="btn btn-secondary" style="text-decoration:none; padding: 14px 32px; border: 1px solid var(--border-color); border-radius: 12px; color: var(--text-main);">Return to Menu</a>
          </div>
        </div>
      `;

      document.body.innerHTML = summaryHtml;
    }
  });

  // Define initial data collection plugins
  class ParticipantIdPlugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
    }
    trial(display_element, trial) {
      const startTime = performance.now();
      display_element.innerHTML = `
        <div class="recognition-task-container">
          <div class="question-container" style="max-width: 500px;">
            <h2>Enter Participant ID</h2>
            <input type="text" id="input-field" class="btn" style="background:#ffffff; border: 1px solid var(--border-color); color:var(--text-main); font-size:1.1rem; padding:10px; width:100%; text-align:center; box-sizing:border-box; margin-bottom:20px; box-shadow: none; cursor: text; font-family: var(--font-main);" placeholder="e.g. P001" required>
            <button id="next-btn" class="btn" style="min-width:120px;">Next</button>
          </div>
        </div>
      `;
      const nextBtn = display_element.querySelector('#next-btn');
      const input = display_element.querySelector('#input-field');
      input.focus();
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && input.value.trim() !== '') {
          nextBtn.click();
        }
      });
      nextBtn.addEventListener('click', () => {
        const val = input.value.trim();
        if (val === '') {
          alert('Please enter Participant ID');
          return;
        }
        if (!val.startsWith('P')) {
          alert('Participant ID must start with "P"');
          return;
        }
        display_element.innerHTML = '';
        this.jsPsych.finishTrial({
          participant_id: val,
          stimulus: "Enter Participant ID",
          response: val,
          rt: Math.round(performance.now() - startTime)
        });
      });
    }
  }
  ParticipantIdPlugin.info = { name: 'participant-id-input', parameters: {} };

  class DatePlugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
    }
    trial(display_element, trial) {
      const startTime = performance.now();
      const today = new Date().toISOString().split('T')[0];
      display_element.innerHTML = `
        <div class="recognition-task-container">
          <div class="question-container" style="max-width: 500px;">
            <h2>Select Date</h2>
            <input type="date" id="input-field" class="btn" value="${today}" style="background:#ffffff; border: 1px solid var(--border-color); color:var(--text-main); font-size:1.1rem; padding:10px; width:100%; text-align:center; box-sizing:border-box; margin-bottom:20px; box-shadow: none; cursor: text; font-family: var(--font-main);" required>
            <button id="next-btn" class="btn" style="min-width:120px;">Next</button>
          </div>
        </div>
      `;
      const nextBtn = display_element.querySelector('#next-btn');
      const input = display_element.querySelector('#input-field');
      input.focus();
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && input.value.trim() !== '') {
          nextBtn.click();
        }
      });
      nextBtn.addEventListener('click', () => {
        const val = input.value.trim();
        if (val === '') {
          alert('Please select date');
          return;
        }
        display_element.innerHTML = '';
        this.jsPsych.finishTrial({
          session_date: val,
          stimulus: "Select Date",
          response: val,
          rt: Math.round(performance.now() - startTime)
        });
      });
    }
  }
  DatePlugin.info = { name: 'session-date-input', parameters: {} };

  class RaNamePlugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
    }
    trial(display_element, trial) {
      const startTime = performance.now();
      display_element.innerHTML = `
        <div class="recognition-task-container">
          <div class="question-container" style="max-width: 500px;">
            <h2>Enter RA Name</h2>
            <input type="text" id="input-field" class="btn" style="background:#ffffff; border: 1px solid var(--border-color); color:var(--text-main); font-size:1.1rem; padding:10px; width:100%; text-align:center; box-sizing:border-box; margin-bottom:20px; box-shadow: none; cursor: text; font-family: var(--font-main);" placeholder="e.g. Jane Doe" required>
            <button id="next-btn" class="btn" style="min-width:120px;">Next</button>
          </div>
        </div>
      `;
      const nextBtn = display_element.querySelector('#next-btn');
      const input = display_element.querySelector('#input-field');
      input.focus();
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && input.value.trim() !== '') {
          nextBtn.click();
        }
      });
      nextBtn.addEventListener('click', () => {
        const val = input.value.trim();
        if (val === '') {
          alert('Please enter RA Name');
          return;
        }
        display_element.innerHTML = '';
        this.jsPsych.finishTrial({
          ra_name: val,
          stimulus: "Enter RA Name",
          response: val,
          rt: Math.round(performance.now() - startTime)
        });
      });
    }
  }
  RaNamePlugin.info = { name: 'ra-name-input', parameters: {} };

  class WaitForStartPlugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
    }
    trial(display_element, trial) {
      const startTime = performance.now();
      display_element.innerHTML = `
        <div class="recognition-task-container">
          <div class="question-container" style="max-width: 600px;">
            <h2 style="margin-bottom: 30px; font-weight: normal; line-height: 1.6;">Please wait for task instructions from the researcher.</h2>
            <input type="text" id="input-field" class="btn" style="background:#ffffff; border: 1px solid var(--border-color); color:var(--text-main); font-size:1.1rem; padding:10px; width:100%; text-align:center; box-sizing:border-box; margin-bottom:20px; box-shadow: none; cursor: text; font-family: var(--font-main);" placeholder="" required>
            <button id="next-btn" class="btn" style="min-width:120px;">Next</button>
          </div>
        </div>
      `;
      const nextBtn = display_element.querySelector('#next-btn');
      const input = display_element.querySelector('#input-field');
      input.focus();
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && input.value.trim().toLowerCase() === 'start') {
          nextBtn.click();
        }
      });
      nextBtn.addEventListener('click', () => {
        const val = input.value.trim().toLowerCase();
        if (val !== 'start') {
          alert('Please type "start" to continue.');
          return;
        }
        display_element.innerHTML = '';
        this.jsPsych.finishTrial({
          stimulus: "Please wait for task instructions from the researcher.",
          response: "start",
          rt: Math.round(performance.now() - startTime)
        });
      });
    }
  }
  WaitForStartPlugin.info = { name: 'wait-for-start', parameters: {} };

  class CompletionInstructionPlugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
    }
    trial(display_element, trial) {
      const startTime = performance.now();
      display_element.innerHTML = `
        <div class="recognition-task-container">
          <div class="question-container" style="max-width: 600px;">
            <h2 style="margin-bottom: 30px; font-weight: normal; line-height: 1.6;">You are now finished with the first part of the task. Please wait for further instructions from the researcher.</h2>
          </div>
        </div>
      `;
      const handleKeyPress = (e) => {
        if (e.key === 'x' || e.key === 'X') {
          document.removeEventListener('keydown', handleKeyPress);
          display_element.innerHTML = '';
          this.jsPsych.finishTrial({
            stimulus: "You are now finished with the first part of the task. Please wait for further instructions from the researcher.",
            response: "X",
            rt: Math.round(performance.now() - startTime)
          });
        }
      };
      document.addEventListener('keydown', handleKeyPress);
    }
  }
  CompletionInstructionPlugin.info = { name: 'completion-instruction', parameters: {} };

  class CuedRecallPlugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
    }
    trial(display_element, trial) {
      const startTime = performance.now();
      display_element.innerHTML = `
        <div class="recognition-task-container">
          <div class="artwork-display" style="max-height: 45vh; max-width: 700px; margin-bottom: 20px;">
            <img src="${trial.image}" id="recognition-image" draggable="false" style="filter: ${trial.image_filter}; max-height: 45vh;">
          </div>
          <div class="interaction-area">
            <div class="question-container" style="max-width: 700px; text-align: left;">
              <h2 style="font-size: 1.1rem; line-height: 1.4; margin-bottom: 20px;">What do you remember about this specific artwork?</h2>
              <textarea id="recall-input" class="btn" style="background:#ffffff; border: 1px solid var(--border-color); color:var(--text-main); font-size:1rem; padding:12px; width:100%; height:120px; box-sizing:border-box; margin-bottom:20px; box-shadow: none; cursor: text; resize: none; text-align: left; font-family: var(--font-main);" placeholder="Type your response here..." required></textarea>
              <div style="display: flex; justify-content: center;">
                <button id="next-btn" class="btn" style="min-width:140px; font-weight: 600;">Submit</button>
              </div>
            </div>
          </div>
        </div>
      `;
      const nextBtn = display_element.querySelector('#next-btn');
      const input = display_element.querySelector('#recall-input');
      input.focus();
      
      nextBtn.addEventListener('click', () => {
        const response = input.value.trim();
        if (response === '') {
          alert('Please write what you remember about this artwork.');
          input.focus();
          return;
        }
        display_element.innerHTML = '';
        this.jsPsych.finishTrial({
          stimulus: trial.image,
          response: response,
          rt: Math.round(performance.now() - startTime),
          image_id: trial.image,
          artwork_index: trial.artwork_index,
          cued_recall_response: response
        });
      });
    }
  }
  CuedRecallPlugin.info = { name: 'cued-recall-task', parameters: {} };

  const participant_id_trial = {
    type: ParticipantIdPlugin
  };

  const date_trial = {
    type: DatePlugin
  };

  const ra_name_trial = {
    type: RaNamePlugin
  };

  const wait_for_start_trial = {
    type: WaitForStartPlugin
  };

  const completion_instruction_trial = {
    type: CompletionInstructionPlugin
  };

  // 4. Local Artworks (Replacing Supabase)
  const artworks = [
    { id: 1, image_url: 'assets/Real/Argote_2of6_Small.png', title: 'Argote 2of6', filter: 'none', image_type: true },
    { id: 2, image_url: 'assets/Real/Argote_4of6_Small.png', title: 'Argote 4of6', filter: 'none', image_type: true },
    { id: 3, image_url: 'assets/Real/Argote_6of6_Small.png', title: 'Argote 6of6', filter: 'none', image_type: true },
    { id: 4, image_url: 'assets/Real/Caboco_2of2_Small.png', title: 'Caboco 2of2', filter: 'none', image_type: true },
    { id: 5, image_url: 'assets/Real/Chaile_1aof4_Small.png', title: 'Chaile 1aof4', filter: 'none', image_type: true },
    { id: 6, image_url: 'assets/Real/Chaile_2of4_Small.png', title: 'Chaile 2of4', filter: 'none', image_type: true },
    { id: 7, image_url: 'assets/Real/Dominguez_10of12_Small.png', title: 'Dominguez 10of12', filter: 'none', image_type: true },
    { id: 8, image_url: 'assets/Real/Dominguez_11of12_Small.png', title: 'Dominguez 11of12', filter: 'none', image_type: true },
    { id: 9, image_url: 'assets/Real/Dominguez_1of12_Small.png', title: 'Dominguez 1of12', filter: 'none', image_type: true },
    { id: 10, image_url: 'assets/Real/Dominguez_7of12_Small.png', title: 'Dominguez 7of12', filter: 'none', image_type: true },
    { id: 11, image_url: 'assets/Real/Dominguez_9of12_Small.png', title: 'Dominguez 9of12', filter: 'none', image_type: true },
    { id: 12, image_url: 'assets/Real/Dominiguez_6of12_Small.png', title: 'Dominiguez 6of12', filter: 'none', image_type: true },
    { id: 13, image_url: 'assets/Real/Esbell_1of3_Small.png', title: 'Esbell 1of3', filter: 'none', image_type: true },
    { id: 14, image_url: 'assets/Real/Esbell_3aof3_Small.png', title: 'Esbell 3aof3', filter: 'none', image_type: true },
    { id: 15, image_url: 'assets/Real/Gutierrez_1of8_Small.png', title: 'Gutierrez 1of8', filter: 'none', image_type: true },
    { id: 16, image_url: 'assets/Real/Gutierrez_2of8_Small.png', title: 'Gutierrez 2of8', filter: 'none', image_type: true },
    { id: 17, image_url: 'assets/Real/Gutierrez_4of8_Small.png', title: 'Gutierrez 4of8', filter: 'none', image_type: true },
    { id: 18, image_url: 'assets/Real/Gutierrez_5of8_Small.png', title: 'Gutierrez 5of8', filter: 'none', image_type: true },
    { id: 19, image_url: 'assets/Real/Hakihiiwe_12of22_Small.png', title: 'Hakihiiwe 12of22', filter: 'none', image_type: true },
    { id: 20, image_url: 'assets/Real/Hakihiiwe_14of22_Small.png', title: 'Hakihiiwe 14of22', filter: 'none', image_type: true },
    { id: 21, image_url: 'assets/Real/Hakihiiwe_16of22_Small.png', title: 'Hakihiiwe 16of22', filter: 'none', image_type: true },
    { id: 22, image_url: 'assets/Real/Hakihiiwe_17of22_Small.png', title: 'Hakihiiwe 17of22', filter: 'none', image_type: true },
    { id: 23, image_url: 'assets/Real/Hakihiiwe_4of22_Small.png', title: 'Hakihiiwe 4of22', filter: 'none', image_type: true },
    { id: 24, image_url: 'assets/Real/Hakihiiwe_6of22_Small.png', title: 'Hakihiiwe 6of22', filter: 'none', image_type: true },
    { id: 25, image_url: 'assets/Real/Hakihiiwe_7of22_Small.png', title: 'Hakihiiwe 7of22', filter: 'none', image_type: true },
    { id: 26, image_url: 'assets/Real/Hakihiiwe_9of22_Small.png', title: 'Hakihiiwe 9of22', filter: 'none', image_type: true },
    { id: 27, image_url: 'assets/Real/Halfmoon_1of1_Small.png', title: 'Halfmoon 1of1', filter: 'none', image_type: true },
    { id: 28, image_url: 'assets/Real/Maravilla_1of5_Small.png', title: 'Maravilla 1of5', filter: 'none', image_type: true },
    { id: 29, image_url: 'assets/Real/Maravilla_2of5_Small.png', title: 'Maravilla 2of5', filter: 'none', image_type: true },
    { id: 30, image_url: 'assets/Real/Maravilla_3of5_Small.png', title: 'Maravilla 3of5', filter: 'none', image_type: true },
    { id: 31, image_url: 'assets/Real/Maravilla_5of5_Small.png', title: 'Maravilla 5of5', filter: 'none', image_type: true },
    { id: 32, image_url: 'assets/Real/Merida_1of1_Small.png', title: 'Merida 1of1', filter: 'none', image_type: true },
    { id: 33, image_url: 'assets/Real/Simpson_11of14_Small.png', title: 'Simpson 11of14', filter: 'none', image_type: true },
    { id: 34, image_url: 'assets/Real/Simpson_13of14_Small.png', title: 'Simpson 13of14', filter: 'none', image_type: true },
    { id: 35, image_url: 'assets/Real/Simpson_1of14_Small.png', title: 'Simpson 1of14', filter: 'none', image_type: true },
    { id: 36, image_url: 'assets/Real/Simpson_3of14_Small.png', title: 'Simpson 3of14', filter: 'none', image_type: true },
    { id: 37, image_url: 'assets/Real/Simpson_4of14_Small.png', title: 'Simpson 4of14', filter: 'none', image_type: true },
    { id: 38, image_url: 'assets/Real/Simpson_7of14_Small.png', title: 'Simpson 7of14', filter: 'none', image_type: true },
    { id: 39, image_url: 'assets/Real/Sully_1of2_Small.png', title: 'Sully 1of2', filter: 'none', image_type: true },
    { id: 40, image_url: 'assets/Real/Sully_2of2_Small.png', title: 'Sully 2of2', filter: 'none', image_type: true },
    { id: 41, image_url: 'assets/Real/Tavares_2of7_Small.png', title: 'Tavares 2of7', filter: 'none', image_type: true },
    { id: 42, image_url: 'assets/Real/Tavares_3of7_Small.png', title: 'Tavares 3of7', filter: 'none', image_type: true },
    { id: 43, image_url: 'assets/Real/Tavares_4of7_Small.png', title: 'Tavares 4of7', filter: 'none', image_type: true },
    { id: 44, image_url: 'assets/Real/Tavares_6of7_Small.png', title: 'Tavares 6of7', filter: 'none', image_type: true },
    { id: 45, image_url: 'assets/Real/Toledo_1of1_Small.png', title: 'Toledo 1of1', filter: 'none', image_type: true },
    { id: 46, image_url: 'assets/Real/Yahuarcani_1of3_Small.png', title: 'Yahuarcani 1of3', filter: 'none', image_type: true },
    { id: 47, image_url: 'assets/Real/Yahuarcani_3of3_Small.png', title: 'Yahuarcani 3of3', filter: 'none', image_type: true },
    { id: 48, image_url: 'assets/Real/deBaca_1of1_Small.png', title: 'deBaca 1of1', filter: 'none', image_type: true },
    { id: 49, image_url: 'assets/Lure/Argote_1of6_Lure_Small.png', title: 'Argote 1of6', filter: 'none', image_type: false },
    { id: 50, image_url: 'assets/Lure/Argote_2of6_Lure_Small.png', title: 'Argote 2of6', filter: 'none', image_type: false },
    { id: 51, image_url: 'assets/Lure/Argote_3of6_Lure_Small.png', title: 'Argote 3of6', filter: 'none', image_type: false },
    { id: 52, image_url: 'assets/Lure/Caboco_2of2_Lure_Small.png', title: 'Caboco 2of2', filter: 'none', image_type: false },
    { id: 53, image_url: 'assets/Lure/Chaile_1of4_Lure_Small.png', title: 'Chaile 1of4', filter: 'none', image_type: false },
    { id: 54, image_url: 'assets/Lure/Chaile_2of4_Lure_Small.png', title: 'Chaile 2of4', filter: 'none', image_type: false },
    { id: 55, image_url: 'assets/Lure/Dominguez_10of12_Lure_Small.png', title: 'Dominguez 10of12', filter: 'none', image_type: false },
    { id: 56, image_url: 'assets/Lure/Dominguez_12of12_Lure_Small.png', title: 'Dominguez 12of12', filter: 'none', image_type: false },
    { id: 57, image_url: 'assets/Lure/Dominguez_2of12_Lure_Small.png', title: 'Dominguez 2of12', filter: 'none', image_type: false },
    { id: 58, image_url: 'assets/Lure/Dominguez_4of12_Lure_Small.png', title: 'Dominguez 4of12', filter: 'none', image_type: false },
    { id: 59, image_url: 'assets/Lure/Dominguez_6of12_Lure_Small.png', title: 'Dominguez 6of12', filter: 'none', image_type: false },
    { id: 60, image_url: 'assets/Lure/Dominguez_7of12_Lure_Small.png', title: 'Dominguez 7of12', filter: 'none', image_type: false },
    { id: 61, image_url: 'assets/Lure/Esbell_2of3_Lure_Small.png', title: 'Esbell 2of3', filter: 'none', image_type: false },
    { id: 62, image_url: 'assets/Lure/Esbell_4of3_Lure_Small.png', title: 'Esbell 4of3', filter: 'none', image_type: false },
    { id: 63, image_url: 'assets/Lure/Gutierrez_3of8_Lure_Small.png', title: 'Gutierrez 3of8', filter: 'none', image_type: false },
    { id: 64, image_url: 'assets/Lure/Gutierrez_5of8_Lure_Small.png', title: 'Gutierrez 5of8', filter: 'none', image_type: false },
    { id: 65, image_url: 'assets/Lure/Gutierrez_6of8_Lure_Small.png', title: 'Gutierrez 6of8', filter: 'none', image_type: false },
    { id: 66, image_url: 'assets/Lure/Gutierrez_7of8_Lure_Small.png', title: 'Gutierrez 7of8', filter: 'none', image_type: false },
    { id: 67, image_url: 'assets/Lure/Hakihiiwe_11of22_Lure_Small.png', title: 'Hakihiiwe 11of22', filter: 'none', image_type: false },
    { id: 68, image_url: 'assets/Lure/Hakihiiwe_12of22_Lure_Small.png', title: 'Hakihiiwe 12of22', filter: 'none', image_type: false },
    { id: 69, image_url: 'assets/Lure/Hakihiiwe_21of22_Lure_Small.png', title: 'Hakihiiwe 21of22', filter: 'none', image_type: false },
    { id: 70, image_url: 'assets/Lure/Hakihiiwe_22of22_Lure_Small.png', title: 'Hakihiiwe 22of22', filter: 'none', image_type: false },
    { id: 71, image_url: 'assets/Lure/Hakihiiwe_3of22_Lure_Small.png', title: 'Hakihiiwe 3of22', filter: 'none', image_type: false },
    { id: 72, image_url: 'assets/Lure/Hakihiiwe_4of22_Lure_Small.png', title: 'Hakihiiwe 4of22', filter: 'none', image_type: false },
    { id: 73, image_url: 'assets/Lure/Hakihiiwe_6of22_Lure_Small.png', title: 'Hakihiiwe 6of22', filter: 'none', image_type: false },
    { id: 74, image_url: 'assets/Lure/Hakihiiwe_9of22_Lure_Small.png', title: 'Hakihiiwe 9of22', filter: 'none', image_type: false },
    { id: 75, image_url: 'assets/Lure/Halfmoon_Lure_Small.png', title: 'Halfmoon', filter: 'none', image_type: false },
    { id: 76, image_url: 'assets/Lure/Maravilla_5of5_Lure_Small.png', title: 'Maravilla 5of5', filter: 'none', image_type: false },
    { id: 77, image_url: 'assets/Lure/Maravilla_Lure2_Small.png', title: 'Maravilla Lure2', filter: 'none', image_type: false },
    { id: 78, image_url: 'assets/Lure/Maravilla_Lure5_copy_Small.png', title: 'Maravilla Lure5 copy', filter: 'none', image_type: false },
    { id: 79, image_url: 'assets/Lure/Maravilla_Lure_Small.png', title: 'Maravilla', filter: 'none', image_type: false },
    { id: 80, image_url: 'assets/Lure/Merida_1of1_Lure_Small.png', title: 'Merida 1of1', filter: 'none', image_type: false },
    { id: 81, image_url: 'assets/Lure/Simpson_11of14_Lure_Small.png', title: 'Simpson 11of14', filter: 'none', image_type: false },
    { id: 82, image_url: 'assets/Lure/Simpson_13of14_Lure_Small.png', title: 'Simpson 13of14', filter: 'none', image_type: false },
    { id: 83, image_url: 'assets/Lure/Simpson_1of14_Lure_Small.png', title: 'Simpson 1of14', filter: 'none', image_type: false },
    { id: 84, image_url: 'assets/Lure/Simpson_3of14_Lure_Small.png', title: 'Simpson 3of14', filter: 'none', image_type: false },
    { id: 85, image_url: 'assets/Lure/Simpson_4of14_Lure_Small.png', title: 'Simpson 4of14', filter: 'none', image_type: false },
    { id: 86, image_url: 'assets/Lure/Simpson_8of14_Lure_Small.png', title: 'Simpson 8of14', filter: 'none', image_type: false },
    { id: 87, image_url: 'assets/Lure/Sully_1of2_Lure_Small.png', title: 'Sully 1of2', filter: 'none', image_type: false },
    { id: 88, image_url: 'assets/Lure/Sully_2of2_Lure_Small.png', title: 'Sully 2of2', filter: 'none', image_type: false },
    { id: 89, image_url: 'assets/Lure/Tavares_2of7_Lure_Small.png', title: 'Tavares 2of7', filter: 'none', image_type: false },
    { id: 90, image_url: 'assets/Lure/Tavares_3of7_Lure_Small.png', title: 'Tavares 3of7', filter: 'none', image_type: false },
    { id: 91, image_url: 'assets/Lure/Tavares_4of7_Lure_Small.png', title: 'Tavares 4of7', filter: 'none', image_type: false },
    { id: 92, image_url: 'assets/Lure/Tavares_6of7_Lure_Small.png', title: 'Tavares 6of7', filter: 'none', image_type: false },
    { id: 93, image_url: 'assets/Lure/Toledo_1of1_Lure_Small.png', title: 'Toledo 1of1', filter: 'none', image_type: false },
    { id: 94, image_url: 'assets/Lure/Yahuaracani_1of3_Lure_Small.png', title: 'Yahuaracani 1of3', filter: 'none', image_type: false },
    { id: 95, image_url: 'assets/Lure/Yahuaracani_3of3_Lure_Small.png', title: 'Yahuaracani 3of3', filter: 'none', image_type: false },
    { id: 96, image_url: 'assets/Lure/deBaca_1of1_Lure_Small.png', title: 'deBaca 1of1', filter: 'none', image_type: false },
    // Test Trials
    { id: 97, image_url: 'test_trials/testImage1.png', title: 'Test Image 1', filter: 'none', image_type: true },
    { id: 98, image_url: 'test_trials/testImage2.png', title: 'Test Image 2', filter: 'none', image_type: false }
  ];

  // Create timeline based on fetched artworks
  const mainTimeline = [];

  // Collect all image URLs for preloading
  const allImages = artworks.map(art => art.image_url);

  // Preload all images
  mainTimeline.push({
    type: jsPsychPreload,
    images: allImages,
  });
  mainTimeline.push({
    type: jsPsychPreload,
    auto_preload: true,
    show_detailed_errors: true,
  });

  // Add the initial pages before moving on to the task
  mainTimeline.push(participant_id_trial, date_trial, ra_name_trial, wait_for_start_trial);

  const realArtworks = artworks.filter(art => art.image_type === true);
  const lastRealArtwork = realArtworks[realArtworks.length - 1];

  // Randomize presentation order of images for the recognition task
  const shuffledArtworks = artworks.slice();
  for (let i = shuffledArtworks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledArtworks[i], shuffledArtworks[j]] = [shuffledArtworks[j], shuffledArtworks[i]];
  }

  shuffledArtworks.forEach((art) => {
    const index = artworks.indexOf(art);
    const isReal = art.image_type === true;
    const isLastReal = art === lastRealArtwork;

    const recognition_confidence_trial = {
      type: jsPsychRecognitionTask,
      image: art.image_url,
      image_filter: art.filter,
      phase: 'confidence',
      data: {
        artwork_index: index
      }
    };

    // Temporal memory trials (relative duration + timeline) are only for Real images
    if (isReal) {
      const relative_duration_trial = {
        type: jsPsychRecognitionTask,
        image: art.image_url,
        image_filter: art.filter,
        phase: 'duration',
        data: {
          artwork_index: index
        }
      };

      const timeline_trial = {
        type: jsPsychTimelineTask,
        image: art.image_url,
        image_filter: art.filter,
        is_last_artwork: isLastReal,
        data: {
          artwork_index: index
        }
      };

      const if_node = {
        timeline: [relative_duration_trial, timeline_trial],
        conditional_function: function () {
          const lastData = jsPsych.data.get().last(1).values()[0];
          if (lastData && lastData.recognized) {
            return true;
          } else {
            return false;
          }
        }
      };

      mainTimeline.push(recognition_confidence_trial, if_node);
    } else {
      mainTimeline.push(recognition_confidence_trial);
    }
  });

  // Now, add the completion instruction page!
  mainTimeline.push(completion_instruction_trial);

  // Now, add the conditional cued recall trials for Real images only!
  // Show only artworks reported as seen for longer than average, in random order.
  // Shuffle a copy of realArtworks for random cued recall presentation order.
  const shuffledRealArtworks = realArtworks.slice();
  for (let i = shuffledRealArtworks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledRealArtworks[i], shuffledRealArtworks[j]] = [shuffledRealArtworks[j], shuffledRealArtworks[i]];
  }

  shuffledRealArtworks.forEach((art) => {
    const artworkIndex = artworks.indexOf(art);
    const recall_trial = {
      type: CuedRecallPlugin,
      image: art.image_url,
      image_filter: art.filter,
      artwork_index: artworkIndex
    };

    const conditional_recall_node = {
      timeline: [recall_trial],
      conditional_function: function() {
        // Check if artwork was recognized AND reported as seen for longer than average
        const artTrials = jsPsych.data.get().filter({ image_id: art.image_url, trial_type: 'recognition-task' }).values();
        const recognizedTrial = artTrials.find(t => t.recognized === true);
        const durationTrial = artTrials.find(t => t.relative_duration !== null && t.relative_duration !== undefined);
        const aboveAverage = durationTrial && (durationTrial.relative_duration === 'Little more' || durationTrial.relative_duration === 'Much more');
        return !!recognizedTrial && !!aboveAverage;
      }
    };

    mainTimeline.push(conditional_recall_node);
  });

  // Start the experiment
  jsPsych.run(mainTimeline);
}

// Global invocation
startExperiment();
