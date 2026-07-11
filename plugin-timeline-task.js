
var jsPsychTimelineTask = (function (jspsych) {
  'use strict';

  const info = {
    name: 'timeline-task',
    parameters: {
      image: {
        type: jspsych.ParameterType.IMAGE,
        default: undefined,
        description: 'The image to display.'
      },
      image_filter: {
        type: jspsych.ParameterType.STRING,
        default: 'none',
        description: 'CSS filter to apply to the image.'
      },
      is_last_artwork: {
        type: jspsych.ParameterType.BOOL,
        default: false,
        description: 'Whether this is the last artwork in the session.'
      },
      timeline_duration_minutes: {
        type: jspsych.ParameterType.INT,
        default: 45,
        description: 'Total length of the timeline in minutes.'
      },
      time_increment_seconds: {
        type: jspsych.ParameterType.INT,
        default: 5,
        description: 'Snapping interval in seconds.'
      }
    }
  };

  class TimelineTaskPlugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
    }

    trial(display_element, trial) {
      // Store trial for use in endTrial
      this.trial = trial;

      // Logic variables
      this.placedItems = new Map(); // id -> { id, element, timeSec, durationSec }
      this.totalSecs = trial.timeline_duration_minutes * 60;
      this.activeItem = null; // item currently being placed or edited
      
      // Inject HTML
      let html = `
        <div class="timeline-task-container">
          <div class="task-header">
            <div class="header-titles">
              <p>Click on the timeline to indicate when you saw this artwork.</p>
            </div>
            <button id="finish-btn" class="finish-btn" disabled>${trial.is_last_artwork ? 'Complete Task' : 'Next Artwork'}</button>
          </div>
          
          <div class="work-area single-image-work-area">
            <div class="single-art-container" id="single-art-container">
                <div class="art-item" id="art-target" data-src="${trial.image}" data-filter="${trial.image_filter || 'none'}">
                  <img src="${trial.image}" draggable="false" style="filter: ${trial.image_filter || 'none'};">
                </div>
            </div>
            
            <div class="timeline-area">
              <div class="timeline-track-container" id="timeline-track-container">
                <div class="timeline-track"></div>
                <div class="timeline-ticks" id="timeline-ticks"></div>
                <div class="timeline-dropzone" id="timeline-dropzone"></div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      display_element.innerHTML = html;

      // Setup DOM references
      this.singleArtContainer = display_element.querySelector('#single-art-container');
      this.timelineContainer = display_element.querySelector('#timeline-track-container');
      this.dropzone = display_element.querySelector('#timeline-dropzone');
      this.ticksContainer = display_element.querySelector('#timeline-ticks');
      this.finishBtn = display_element.querySelector('#finish-btn');

      this.numItemsRequired = 1;
      this.startTime = performance.now();
      
      this.renderTicks(trial.timeline_duration_minutes);
      this.setupInteractionHandlers(trial.time_increment_seconds);
      
      this.finishBtn.addEventListener('click', () => {
        this.endTrial();
      });
    }

    renderTicks(minutes) {
      // Render 4 tick marks: Beginning, two unlabeled, and End
      const labels = ['Beginning', '', '', 'End'];
      for (let i = 0; i < 4; i++) {
        let percent = (i / 3) * 100;
        let tick = document.createElement('div');
        tick.className = 'tick';
        tick.style.left = `${percent}%`;
        tick.innerHTML = `<span>${labels[i]}</span>`;
        this.ticksContainer.appendChild(tick);
      }
    }

    setupInteractionHandlers(incrementSecs) {
      // Timeline Dropzone Click mechanics

      this.dropzone.addEventListener('click', (e) => {
        let rawPercent = e.offsetX / this.dropzone.offsetWidth;
        if(rawPercent < 0) rawPercent = 0; if(rawPercent > 1) rawPercent = 1;
        
        let seconds = rawPercent * this.totalSecs;
        let snappedSecs = Math.round(seconds / incrementSecs) * incrementSecs;
        
        const sourceElem = this.singleArtContainer.querySelector('.art-item');
        const itemId = sourceElem.id;

        if (!this.firstDropRt) {
            this.firstDropRt = Math.round(performance.now() - this.startTime);
        }

        // Remove existing marker if any
        const existingMarker = this.timelineContainer.querySelector('.timeline-marker');
        if (existingMarker) {
            existingMarker.remove();
        }

        const percent = (snappedSecs / this.totalSecs) * 100;
        const marker = document.createElement('div');
        marker.className = 'timeline-marker';
        marker.style.left = `${percent}%`;
        
        const img = document.createElement('img');
        img.src = sourceElem.dataset.src;
        img.style.filter = sourceElem.dataset.filter || 'none';
        img.draggable = false;
        marker.appendChild(img);
        
        this.timelineContainer.appendChild(marker);
        sourceElem.classList.add('placed');
        
        this.placedItems.set(itemId, {
          id: itemId,
          markerElement: marker,
          timeSec: snappedSecs,
          durationSec: null
        });

        this.checkCompletion();
      });
    }

    checkCompletion() {
      if (this.placedItems.size === this.numItemsRequired) {
        this.finishBtn.disabled = false;
      }
    }

    endTrial() {
      // Gather data
      let responseData = {
        stimulus: this.trial.image,
        response: null,
        rt: Math.round(performance.now() - this.startTime),
        image_id: this.trial.image,
        timeline_position_sec: null,
        estimated_duration_sec: null,
        rt_timeline: null,
        rt_recognition: null
      };

      this.placedItems.forEach((val) => {
        responseData.response = val.timeSec;
        responseData.image_id = this.trial.image;
        responseData.timeline_position_sec = val.timeSec;
        responseData.estimated_duration_sec = val.durationSec;
        responseData.rt_timeline = this.firstDropRt || Math.round(performance.now() - this.startTime);
        responseData.rt_recognition = this.firstDropRt || Math.round(performance.now() - this.startTime);
      });

      // Clear DOM
      this.jsPsych.getDisplayElement().innerHTML = '';

      // Return data
      this.jsPsych.finishTrial(responseData);
    }
  }

  TimelineTaskPlugin.info = info;

  return TimelineTaskPlugin;
})(jsPsychModule);
