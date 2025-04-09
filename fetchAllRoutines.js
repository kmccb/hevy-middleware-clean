const fetchAllRoutines = async () => {
  try {
    const routines = [];
    let page = 1;
    const pageSize = 10;

    while (true) {
      const response = await axios.get(`https://api.hevyapp.com/v1/routines?page=${page}&pageSize=${pageSize}`, {
        headers: {
          'api-key': HEVY_API_KEY,
          'accept': 'application/json',
        },
      });

      const data = response.data;
      if (!data.routines || data.routines.length === 0) break;

      routines.push(...data.routines);
      if (page >= data.page_count) break;
      page++;
    }

    // Log routines with formatting
    console.log('All retrieved routines:');
    routines.forEach((routine, index) => {
      console.log(`Routine ${index + 1}:`);
      console.log(JSON.stringify(routine, null, 2));
      console.log('---');
    });

    const filePath = path.join(__dirname, 'data', 'routines.json');
    fs.writeFileSync(filePath, JSON.stringify(routines, null, 2));
    console.log(`✅ Routines saved to routines.json (${routines.length} total)`);

    return { success: true, count: routines.length };
  } catch (err) {
    console.error('❌ Failed to fetch routines:', err.message);
    return { success: false, error: err.message };
  }
};