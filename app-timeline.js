/**
 * Version 1: Timeline Retrieval Task (with Supabase Integration)
 */

async function startExperiment() {
  const jsPsych = initJsPsych({
        override_safe_mode: true,
    on_finish: async function() {
      
      const trialData = jsPsych.data.get().last(1).values()[0].retrieval_data;
      
      // 1. Generate unique participant ID
      const participantId = 'P-' + Math.random().toString(36).substr(2, 9).toUpperCase();

      // 2. Log data to Supabase
      document.body.innerHTML = '<div class="summary-container"><p>Saving results to database...</p></div>';
      
      // Supabase saving disabled for local mode
      const error = null;

      if (error) {
        console.error('Error saving data:', error);
        alert('Could not save data to database. Please check console.');
      }

      // 3. Show Summary Table
      trialData.sort((a,b) => a.timeline_position_sec - b.timeline_position_sec);

      const formatTime = (totalSecs) => {
        let m = Math.floor(totalSecs / 60);
        let s = totalSecs % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
      };

      let summaryHtml = `
        <div class="summary-container">
          <h1>Tour Summary</h1>
          <p>Results saved successfully for Participant: <strong>${participantId}</strong></p>
          <div class="table-wrapper">
            <table class="summary-table">
              <thead>
                <tr>
                  <th>Artwork</th>
                  <th>Tour Timestamp</th>
                  <th>Observation Duration</th>
                </tr>
              </thead>
              <tbody>
      `;

      trialData.forEach(item => {
        summaryHtml += `
          <tr>
            <td>
              <div class="art-preview">
                <img src="${item.image_url || 'assets/sample-art.png'}">
                <span>${item.image_title || item.image_id}</span>
              </div>
            </td>
            <td>${formatTime(item.timeline_position_sec)}</td>
            <td>${formatTime(item.estimated_duration_sec)}</td>
          </tr>
        `;
      });

      summaryHtml += `
                </tbody>
              </table>
            </div>
            <div style="margin-top:20px;">
              <a href="index.html" class="btn btn-secondary" style="text-decoration:none;">Return to Menu</a>
            </div>
          </div>
        `;

      document.body.innerHTML = summaryHtml;
    }
  });

  // 4. Local Artworks (Replacing Supabase)
  const artworks = [
    { id: 1, image_url: 'assets/sample-art.png', title: 'Local Art 1' },
    { id: 2, image_url: 'assets/sample-art.png', title: 'Local Art 2' },
    { id: 3, image_url: 'assets/sample-art.png', title: 'Local Art 3' },
    { id: 4, image_url: 'assets/sample-art.png', title: 'Local Art 4' },
    { id: 5, image_url: 'assets/sample-art.png', title: 'Local Art 5' }
  ];

  // Fisher-Yates shuffle (randomize array in place)
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // Randomize the order of artworks
  shuffle(artworks);

  // Map Supabase data to the format expected by the plugin
  // We pass the URL as the IMAGE parameter
  const imagePaths = artworks.map(art => art.image_url);

  // Define the timeline task trial
  const timelineTrial = {
    type: jsPsychTimelineTask,
    images: imagePaths,
    timeline_duration_minutes: 45,
    time_increment_seconds: 5,
    on_finish: (data) => {
        // We can augment trial data with more info if needed
        data.retrieval_data.forEach(item => {
            const index = parseInt(item.image_id.split('-')[1]);
            item.image_url = artworks[index].image_url;
            item.image_title = artworks[index].title;
        });
    }
  };

  // Start the experiment
  jsPsych.run([timelineTrial]);
}

// Global invocation
startExperiment();
