const apiKey = 'JU7TE2S574463W653KOETCNKH4';

async function run() {
  const searchUrl = `https://api.golfcourseapi.com/v1/search?search_query=Gorge%20Vale`;
  try {
    const res = await fetch(searchUrl, {
      headers: { 'Authorization': `Key ${apiKey}`, 'Accept': 'application/json' }
    });
    const searchData = await res.json();
    if (searchData.courses && searchData.courses.length > 0) {
      const courseId = searchData.courses[0].id;
      const detailUrl = `https://api.golfcourseapi.com/v1/courses/${courseId}`;
      const detailRes = await fetch(detailUrl, {
        headers: { 'Authorization': `Key ${apiKey}`, 'Accept': 'application/json' }
      });
      const detailData = await detailRes.json();
      const course = detailData.course || {};
      console.log("Course Name:", course.course_name);
      console.log("Coordinates:", course.location);
    }
  } catch (err) {
    console.error(err);
  }
}

run();
