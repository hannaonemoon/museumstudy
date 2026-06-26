
var jsPsychRecognitionTask = (function (jspsych) {
  'use strict';

  const info = {
    name: 'recognition-task',
    parameters: {
      image: {
        type: jspsych.ParameterType.IMAGE,
        default: undefined,
        description: 'The image to be displayed.'
      },
      image_filter: {
        type: jspsych.ParameterType.STRING,
        default: 'none',
        description: 'CSS filter to apply to the image.'
      },
      phase: {
        type: jspsych.ParameterType.STRING,
        default: 'confidence',
        description: 'Which phase of the recognition task to run: "confidence" or "duration".'
      }
    }
  };

  class RecognitionTaskPlugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
    }

    trial(display_element, trial) {
      this.display_element = display_element;
      this.trial = trial;

      // Inject initial HTML depending on the active phase
      let html = '';
      if (trial.phase === 'duration') {
        html = `
          <div class="recognition-task-container">
            <div class="artwork-display">
              <img src="${trial.image}" id="recognition-image" draggable="false" style="filter: ${trial.image_filter};">
            </div>
            
            <div class="interaction-area" id="interaction-area">
              <div class="question-container" id="phase2-container">
                <h2 style="font-size: 16px;">How much time did you spend looking at this artwork relative to the average amount of time spent on each artwork during the tour?</h2>
                <div class="button-group duration-group">
                  <button class="btn btn-duration" data-duration="Much less">Much less</button>
                  <button class="btn btn-duration" data-duration="Little less">Little less</button>
                  <button class="btn btn-duration" data-duration="About the same">About the same</button>
                  <button class="btn btn-duration" data-duration="Little more">Little more</button>
                  <button class="btn btn-duration" data-duration="Much more">Much more</button>
                </div>
              </div>
            </div>
          </div>
        `;
      } else {
        html = `
          <div class="recognition-task-container">
            <div class="artwork-display">
              <img src="${trial.image}" id="recognition-image" draggable="false" style="filter: ${trial.image_filter};">
            </div>
            
            <div class="interaction-area" id="interaction-area">
              <div class="question-container" id="phase1-container">
                <h2>Was this artwork part of the exhibition?</h2>
                <div class="button-group">
                  <button class="btn btn-choice" data-type="no" data-choice="Definitely NO">Definitely<br>NO</button>
                   <button class="btn btn-choice" data-type="no" data-choice="Probably NO">Probably<br>NO</button>
                  <button class="btn btn-choice" data-type="no" data-choice="Maybe NO">Maybe<br>NO</button>
                  <button class="btn btn-choice" data-type="yes" data-choice="Maybe YES">Maybe<br>YES</button>
                   <button class="btn btn-choice" data-type="yes" data-choice="Probably YES">Probably<br>YES</button>
                  <button class="btn btn-choice" data-type="yes" data-choice="Definitely YES">Definitely<br>YES</button>
                </div>
              </div>
            </div>
          </div>
        `;
      }

      display_element.innerHTML = html;

      // Bind events
      this.startTime = performance.now();

      if (trial.phase === 'duration') {
        this.durationBtns = display_element.querySelectorAll('.btn-duration');
        this.durationBtns.forEach(btn => {
          btn.addEventListener('click', (e) => {
            const dt = Math.round(performance.now() - this.startTime);
            const durationValue = e.target.getAttribute('data-duration');
            this.endTrial(true, null, durationValue, dt, dt);
          });
        });
      } else {
        this.choiceBtns = display_element.querySelectorAll('.btn-choice');
        this.choiceBtns.forEach(btn => {
          btn.addEventListener('click', (e) => {
            const rt = Math.round(performance.now() - this.startTime);
            const confidence = e.target.getAttribute('data-choice');
            const isYes = confidence.toLowerCase().includes('yes');
            this.endTrial(isYes, confidence, null, rt, null);
          });
        });
      }
    }

    endTrial(recognized, confidence, duration, rt_recognition, rt_phase2) {
      // Gather data
      const responseData = {
        stimulus: this.trial.image,
        response: confidence || duration,
        rt: Math.round(performance.now() - this.startTime),
        image_id: this.trial.image,
        recognized: recognized,
        recognition_confidence: confidence,
        relative_duration: duration,
        rt_recognition: rt_recognition,
        rt_phase2: rt_phase2
      };

      // Clear DOM
      this.display_element.innerHTML = '';

      // Return data
      this.jsPsych.finishTrial(responseData);
    }
  }

  RecognitionTaskPlugin.info = info;

  return RecognitionTaskPlugin;
})(jsPsychModule);
