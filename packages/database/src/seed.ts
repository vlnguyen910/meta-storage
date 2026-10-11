import { queryClient } from "./client";
import { SEED_IDS, SEED_USERS } from "./seed-fixtures";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

async function seed() {
  console.log("Starting local database seeding via raw SQL client...");

  console.log("1. Seeding facilities...");
  // Fictional catalog fixtures for local testing, not real metastorage locations.
  const facilitiesData = [
    {
      id: SEED_IDS.facilities["HCM-01"],
      code: "HCM-01",
      name: "metastorage Sài Gòn Central",
      address: "118 Nguyễn Văn Linh",
    },
    {
      id: SEED_IDS.facilities["HCM-02"],
      code: "HCM-02",
      name: "metastorage Bến Thành",
      address: "42 Lê Lai",
    },
    {
      id: SEED_IDS.facilities["HCM-03"],
      code: "HCM-03",
      name: "metastorage Bình Thạnh",
      address: "85 Điện Biên Phủ",
    },
    {
      id: SEED_IDS.facilities["HCM-04"],
      code: "HCM-04",
      name: "metastorage Thảo Điền",
      address: "28 Nguyễn Văn Hưởng",
    },
    {
      id: SEED_IDS.facilities["HCM-05"],
      code: "HCM-05",
      name: "metastorage Phú Nhuận",
      address: "156 Phan Xích Long",
    },
    {
      id: SEED_IDS.facilities["HCM-06"],
      code: "HCM-06",
      name: "metastorage Tân Bình",
      address: "67 Cộng Hòa",
    },
    {
      id: SEED_IDS.facilities["HCM-07"],
      code: "HCM-07",
      name: "metastorage Tân Phú",
      address: "93 Lũy Bán Bích",
    },
    {
      id: SEED_IDS.facilities["HCM-08"],
      code: "HCM-08",
      name: "metastorage Gò Vấp",
      address: "210 Nguyễn Oanh",
    },
    {
      id: SEED_IDS.facilities["HCM-09"],
      code: "HCM-09",
      name: "metastorage Bình Tân",
      address: "134 Tên Lửa",
    },
    {
      id: SEED_IDS.facilities["HCM-10"],
      code: "HCM-10",
      name: "metastorage Thủ Đức",
      address: "55 Võ Văn Ngân",
    },
  ];
  const facilities = [];
  for (const facility of facilitiesData) {
    const [row] = await queryClient`
      INSERT INTO facilities (id, code, name, address, description, is_active)
      VALUES (
        ${facility.id}, ${facility.code}, ${facility.name}, ${`${facility.address}, TP. Hồ Chí Minh`},
        'Dữ liệu mẫu: kho lưu trữ cho gia đình và doanh nghiệp nhỏ, kiểm soát 24/7.', true
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        address = EXCLUDED.address,
        description = EXCLUDED.description,
        is_active = EXCLUDED.is_active
      RETURNING id, code, name
    `;
    if (!row) throw new Error(`Facility ${facility.code} was not created`);
    facilities.push(row);
  }
  const facHcm = facilities.find((facility) => facility.code === "HCM-01");

  if (!facHcm) throw new Error("HCM facility was not created");

  console.log("2. Seeding users...");
  for (const fixture of SEED_USERS) {
    await queryClient`
      INSERT INTO users (id, email, phone, name, role, status, email_verified)
      VALUES (${fixture.id}, ${fixture.email}, ${fixture.phone}, ${fixture.name}, ${fixture.role}, 'ACTIVE', true)
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email, phone = EXCLUDED.phone, name = EXCLUDED.name,
        role = EXCLUDED.role, status = EXCLUDED.status, email_verified = EXCLUDED.email_verified
    `;
  }
  const [customer, staff, manager] = SEED_USERS;

  console.log("3. Seeding facility assignments...");
  for (const assignment of [
    { userId: manager.id, role: "FACILITY_MANAGER" },
    { userId: staff.id, role: "FACILITY_STAFF" },
  ]) {
    await queryClient`
      INSERT INTO facility_assignments (id, user_id, facility_id, role, is_active)
      VALUES (${`90000000-0000-4000-8000-${assignment.userId.slice(-12)}`}, ${assignment.userId}, ${facHcm.id}, ${assignment.role}, true)
      ON CONFLICT (user_id, facility_id) DO UPDATE SET
        is_active = true,
        role = EXCLUDED.role,
        ended_at = null
    `;
  }

  console.log("4. Seeding unit types...");
  // Dimensions below are fictional seed fixtures, not measured facility inventory.
  const unitTypesData = [
    {
      id: SEED_IDS.unitTypes["UT-2M"],
      code: "UT-2M",
      name: "Kho tiêu chuẩn (2 m²)",
      sizeLabel: "2 m²",
      lengthM: 2,
      widthM: 1,
      heightM: 2.5,
      monthlyPrice: 900000,
    },
    {
      id: SEED_IDS.unitTypes["UT-4M"],
      code: "UT-4M",
      name: "Kho tiêu chuẩn (4 m²)",
      sizeLabel: "4 m²",
      lengthM: 2,
      widthM: 2,
      heightM: 2.5,
      monthlyPrice: 1500000,
    },
    {
      id: SEED_IDS.unitTypes["UT-6M"],
      code: "UT-6M",
      name: "Kho tiêu chuẩn (6 m²)",
      sizeLabel: "6 m²",
      lengthM: 3,
      widthM: 2,
      heightM: 2.5,
      monthlyPrice: 2100000,
    },
    {
      id: SEED_IDS.unitTypes["UT-AC-4M"],
      code: "UT-AC-4M",
      name: "Kho kiểm soát ẩm (4 m²)",
      sizeLabel: "4 m² - kiểm soát ẩm",
      lengthM: 2,
      widthM: 2,
      heightM: 2.5,
      monthlyPrice: 1900000,
    },
    {
      id: SEED_IDS.unitTypes["UT-1M"],
      code: "UT-1M",
      name: "Kho tiêu chuẩn (1 m²)",
      sizeLabel: "1 m²",
      lengthM: 1,
      widthM: 1,
      heightM: 2.5,
      monthlyPrice: 500000,
    },
    {
      id: SEED_IDS.unitTypes["UT-8M"],
      code: "UT-8M",
      name: "Kho tiêu chuẩn (8 m²)",
      sizeLabel: "8 m²",
      lengthM: 4,
      widthM: 2,
      heightM: 2.5,
      monthlyPrice: 2700000,
    },
    {
      id: SEED_IDS.unitTypes["UT-10M"],
      code: "UT-10M",
      name: "Kho tiêu chuẩn (10 m²)",
      sizeLabel: "10 m²",
      lengthM: 5,
      widthM: 2,
      heightM: 2.5,
      monthlyPrice: 3300000,
    },
    {
      id: SEED_IDS.unitTypes["UT-15M"],
      code: "UT-15M",
      name: "Kho tiêu chuẩn (15 m²)",
      sizeLabel: "15 m²",
      lengthM: 5,
      widthM: 3,
      heightM: 2.5,
      monthlyPrice: 4800000,
    },
  ];

  const typeMap = new Map<string, string>();
  for (const unitType of unitTypesData) {
    const [row] = await queryClient`
      INSERT INTO unit_types (id, code, name, size_label, length_m, width_m, height_m, monthly_price, is_active)
      VALUES (
        ${unitType.id}, ${unitType.code}, ${unitType.name}, ${unitType.sizeLabel},
        ${unitType.lengthM}, ${unitType.widthM}, ${unitType.heightM}, ${unitType.monthlyPrice}, true
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        size_label = EXCLUDED.size_label,
        length_m = EXCLUDED.length_m,
        width_m = EXCLUDED.width_m,
        height_m = EXCLUDED.height_m,
        monthly_price = EXCLUDED.monthly_price,
        is_active = EXCLUDED.is_active
      RETURNING id, code
    `;
    if (!row) throw new Error(`Unit type ${unitType.code} was not created`);
    typeMap.set(row.code, row.id);
  }

  for (const facility of facilities) {
    for (const unitType of unitTypesData) {
      const unitTypeId = typeMap.get(unitType.code);
      if (!unitTypeId) throw new Error(`Unit type ${unitType.code} was not created`);
      await queryClient`
        INSERT INTO facility_unit_types (facility_id, unit_type_id, is_active)
        VALUES (${facility.id}, ${unitTypeId}, true)
        ON CONFLICT (facility_id, unit_type_id) DO UPDATE SET
          is_active = true,
          updated_at = NOW()
      `;

      // Every type is visible and bookable in the public catalog.
      await queryClient`
        INSERT INTO storage_units (id, facility_id, unit_type_id, code, status)
        VALUES (${`71000000-0000-4000-8000-${facility.id.slice(-6)}${unitType.id.slice(-6)}`}, ${facility.id}, ${unitTypeId}, ${`${facility.code}-${unitType.code}-001`}, 'AVAILABLE')
        ON CONFLICT (id) DO UPDATE SET
          facility_id = EXCLUDED.facility_id,
          unit_type_id = EXCLUDED.unit_type_id,
          status = EXCLUDED.status
      `;
    }
  }

  console.log("5. Seeding storage units...");
  const storageUnitsData = [
    {
      id: SEED_IDS.storageUnits["HCM-01-001"],
      code: "HCM-01-001",
      typeCode: "UT-2M",
      status: "AVAILABLE",
    },
    {
      id: SEED_IDS.storageUnits["HCM-01-002"],
      code: "HCM-01-002",
      typeCode: "UT-2M",
      status: "AVAILABLE",
    },
    {
      id: SEED_IDS.storageUnits["HCM-01-003"],
      code: "HCM-01-003",
      typeCode: "UT-4M",
      status: "AVAILABLE",
    },
    {
      id: SEED_IDS.storageUnits["HCM-01-004"],
      code: "HCM-01-004",
      typeCode: "UT-4M",
      status: "AVAILABLE",
    },
    {
      id: SEED_IDS.storageUnits["HCM-01-005"],
      code: "HCM-01-005",
      typeCode: "UT-6M",
      status: "AVAILABLE",
    },
    {
      id: SEED_IDS.storageUnits["HCM-01-006"],
      code: "HCM-01-006",
      typeCode: "UT-6M",
      status: "OCCUPIED",
    },
    {
      id: SEED_IDS.storageUnits["HCM-01-007"],
      code: "HCM-01-007",
      typeCode: "UT-AC-4M",
      status: "MAINTENANCE",
    },
    {
      id: SEED_IDS.storageUnits["HCM-01-008"],
      code: "HCM-01-008",
      typeCode: "UT-AC-4M",
      status: "INSPECTION",
    },
  ];

  const unitMap = new Map<string, string>();
  for (const storageUnit of storageUnitsData) {
    const typeId = typeMap.get(storageUnit.typeCode);
    if (!typeId) continue;

    const [row] = await queryClient`
      INSERT INTO storage_units (id, facility_id, unit_type_id, code, status)
      VALUES (${storageUnit.id}, ${facHcm.id}, ${typeId}, ${storageUnit.code}, ${storageUnit.status})
      ON CONFLICT (id) DO UPDATE SET
        facility_id = EXCLUDED.facility_id,
        unit_type_id = EXCLUDED.unit_type_id,
        status = EXCLUDED.status
      RETURNING id, code
    `;
    if (row) unitMap.set(row.code, row.id);
  }

  console.log("6. Seeding check-in slots...");
  const checkInSlotsData = [
    {
      id: SEED_IDS.checkInSlots[0],
      name: "Ca 1",
      startTime: "09:00:00",
      endTime: "10:30:00",
    },
    {
      id: SEED_IDS.checkInSlots[1],
      name: "Ca 2",
      startTime: "10:30:00",
      endTime: "12:00:00",
    },
    {
      id: SEED_IDS.checkInSlots[2],
      name: "Ca 3",
      startTime: "14:00:00",
      endTime: "15:30:00",
    },
    {
      id: SEED_IDS.checkInSlots[3],
      name: "Ca 4",
      startTime: "15:30:00",
      endTime: "17:00:00",
    },
  ];
  for (const slot of checkInSlotsData) {
    await queryClient`
      INSERT INTO check_in_slots (id, name, start_time, end_time)
      VALUES (${slot.id}, ${slot.name}, ${slot.startTime}, ${slot.endTime})
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name,
        start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time
    `;
  }

  console.log("7. Seeding bookings, payments and assignments...");
  const now = Date.now();
  const bookingData = [
    {
      id: SEED_IDS.bookings["BK-2026-0001"],
      code: "BK-2026-0001",
      scenario: "CONFIRMED_TODAY",
      typeCode: "UT-2M",
      assignCode: "HCM-01-001",
      contactName: "Lê Thị Mai Linh",
      contactEmail: "customer@metastorage.vn",
      contactPhone: "0900000001",
      months: 1,
      monthlyRate: 900000,
      status: "CONFIRMED",
      // Eligibility depends on the fixed slot and grace period, not seed time.
      dayOffset: 0,
      slotIndex: 0,
      paidOffset: -2 * HOUR_MS,
      paymentStatus: "SUCCEEDED",
    },
    {
      id: SEED_IDS.bookings["BK-2026-0002"],
      code: "BK-2026-0002",
      scenario: "TOO_EARLY",
      typeCode: "UT-4M",
      assignCode: "HCM-01-004",
      contactName: "Trần Minh Đức",
      contactEmail: "duc.tran@example.com",
      contactPhone: "0988776655",
      months: 3,
      monthlyRate: 1500000,
      status: "CONFIRMED",
      // The booking is prepared, but the customer must wait until tomorrow.
      dayOffset: 1,
      slotIndex: 1,
      paidOffset: -6 * HOUR_MS,
      paymentStatus: "SUCCEEDED",
    },
    {
      id: SEED_IDS.bookings["BK-2026-0003"],
      code: "BK-2026-0003",
      scenario: "NO_SHOW",
      typeCode: "UT-6M",
      assignCode: null,
      contactName: "Công ty SmartLog (Anh Tuấn)",
      contactEmail: "contact@smartlog.vn",
      contactPhone: "0903112233",
      months: 6,
      monthlyRate: 2100000,
      // This fixture represents the terminal state after the grace period.
      status: "NO_SHOW",
      dayOffset: -1,
      slotIndex: 2,
      paidOffset: -24 * HOUR_MS,
      paymentStatus: "SUCCEEDED",
    },
  ];

  for (const bookingSeed of bookingData) {
    const typeId = typeMap.get(bookingSeed.typeCode);
    if (!typeId) continue;

    const slot = checkInSlotsData[bookingSeed.slotIndex];
    if (!slot) throw new Error(`Check-in slot for ${bookingSeed.code} was not found`);
    const checkInDate = new Date(now + bookingSeed.dayOffset * DAY_MS + 7 * HOUR_MS)
      .toISOString()
      .slice(0, 10);
    const checkInSlotStart = new Date(`${checkInDate}T${slot.startTime}+07:00`);
    const slotId = slot.id;
    const rentalEndAt = new Date(checkInSlotStart.getTime() + bookingSeed.months * 30 * DAY_MS);
    const rentalFeeAmount = bookingSeed.monthlyRate * bookingSeed.months;
    const depositAmount = bookingSeed.monthlyRate;
    const totalAmount = rentalFeeAmount + depositAmount;
    const suffix = bookingSeed.code.slice(-4).padStart(12, "0");
    const paymentId = `10000000-0000-4000-8000-${suffix}`;

    const [booking] = await queryClient`
      INSERT INTO bookings (
        id, booking_code, user_id, contact_name, contact_email, contact_phone,
        facility_id, unit_type_id, requested_months,
        check_in_date, check_in_slot_id,
        rental_end_at, monthly_rate_snapshot, rental_fee_amount, deposit_amount, total_amount,
        status
      )
      VALUES (
        ${bookingSeed.id}, ${bookingSeed.code}, ${customer.id},
        ${bookingSeed.contactName}, ${bookingSeed.contactEmail}, ${bookingSeed.contactPhone},
        ${facHcm.id}, ${typeId}, ${bookingSeed.months},
        ${checkInDate}, ${slotId}, ${rentalEndAt.toISOString()},
        ${bookingSeed.monthlyRate}, ${rentalFeeAmount}, ${depositAmount}, ${totalAmount},
        ${bookingSeed.status}
      )
      ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        contact_name = EXCLUDED.contact_name,
        contact_email = EXCLUDED.contact_email,
        contact_phone = EXCLUDED.contact_phone,
        facility_id = EXCLUDED.facility_id,
        unit_type_id = EXCLUDED.unit_type_id,
        requested_months = EXCLUDED.requested_months,
        check_in_date = EXCLUDED.check_in_date,
        check_in_slot_id = EXCLUDED.check_in_slot_id,
        rental_end_at = EXCLUDED.rental_end_at,
        monthly_rate_snapshot = EXCLUDED.monthly_rate_snapshot,
        rental_fee_amount = EXCLUDED.rental_fee_amount,
        deposit_amount = EXCLUDED.deposit_amount,
        total_amount = EXCLUDED.total_amount,
        status = EXCLUDED.status,
        updated_at = NOW()
      RETURNING id
    `;

    if (!booking) continue;

    await queryClient`
      INSERT INTO payments (
        id, booking_id, draft_id, hold_token_hash, provider, provider_payment_id,
        idempotency_key, payment_code, total_amount,
        currency, status, paid_at
      )
      VALUES (
        ${paymentId}, ${booking.id}, NULL, ${`seed-hold-${bookingSeed.code}`},
        'MOCK', ${`seed-payment-${bookingSeed.code}`}, ${`seed-idempotency-${bookingSeed.code}`}, ${`SEED${bookingSeed.code}`},
        ${totalAmount}, 'VND',
        ${bookingSeed.paymentStatus}, ${new Date(now + bookingSeed.paidOffset).toISOString()}
      )
      ON CONFLICT (id) DO UPDATE SET
        booking_id = EXCLUDED.booking_id,
        draft_id = EXCLUDED.draft_id,
        payment_code = EXCLUDED.payment_code,
        status = EXCLUDED.status,
        paid_at = EXCLUDED.paid_at,
        updated_at = NOW()
    `;

    // A rerun restores a clean scenario after manual check-in experiments.
    await queryClient`DELETE FROM checkin_verifications WHERE booking_id = ${booking.id}`;
    await queryClient`DELETE FROM unit_assignments WHERE booking_id = ${booking.id}`;

    if (bookingSeed.assignCode) {
      const physicalUnitId = unitMap.get(bookingSeed.assignCode);
      if (physicalUnitId) {
        await queryClient`
          INSERT INTO unit_assignments (id, booking_id, physical_unit_id, assigned_by, status, reason)
          VALUES (
            ${`b0000000-0000-4000-8000-${booking.id.slice(-12)}`}, ${booking.id}, ${physicalUnitId}, ${manager.id}, 'ACTIVE',
            ${`Seed scenario: ${bookingSeed.scenario}`}
          )
        `;
      }
    }

    console.log(`   - ${bookingSeed.code}: ${bookingSeed.scenario}`);
  }

  console.log("✅ Seeding completed successfully!");
  await queryClient.end();
}

seed().catch(async (err) => {
  console.error("❌ Seeding failed:", err);
  await queryClient.end();
  process.exit(1);
});
