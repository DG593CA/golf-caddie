const apiKey = 'JU7TE2S574463W653KOETCNKH4';

async function run() {
  console.log("Searching for 'Gorge Vale'...");
  const searchUrl = `https://api.golfcourseapi.com/v1/search?search_query=Gorge%20Vale`;
  
  try {
    const res = await fetch(searchUrl, {
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Accept': 'application/json'
      }
    });
    
    if (!res.ok) {
      throw new Error(`Search failed: ${res.status}`);
    }
    
    const searchData = await res.json();
    console.log("Search Results:", JSON.stringify(searchData, null, 2));
    
    if (searchData.courses && searchData.courses.length > 0) {
      const courseId = searchData.courses[0].id;
      console.log(`Fetching details for course ID: ${courseId}...`);
      
      const detailUrl = `https://api.golfcourseapi.com/v1/courses/${courseId}`;
      const detailRes = await fetch(detailUrl, {
        headers: {
          'Authorization': `Key ${apiKey}`,
          'Accept': 'application/json'
        }
      });
      
      if (!detailRes.ok) {
        throw new Error(`Details fetch failed: ${detailRes.status}`);
      }
      
      const detailData = await detailRes.json();
      console.log("Detailed Course Info:", JSON.stringify(detailData, null, 2));
    } else {
      console.log("No courses found.");
    }
  } catch (err) {
    console.error("Error query Golf Course API:", err);
  }
}

run();
