
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { ErrorView } from '@/components/common/ErrorView';
import { Input } from '@/components/common/Input';
import { Loader } from '@/components/common/Loader';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import {
  createPartnerHotel,
  getPartnerHotel,
  updatePartnerHotel,
  updatePartnerHotelStatus,
  uploadPartnerHotelImages,
} from '@/services/api/hotelApi';
import type { Hotel, HotelInput } from '@/types/hotel';
import { hotelErrorMessage } from '@/utils/hotelErrors';

type Props = {
  hotelId?: string;
  onSaved?: (hotel: Hotel) => void;
  onInactive?: () => void;
};

export function PartnerHotelForm({
  hotelId,
  onSaved,
  onInactive,
}: Props) {
  const [hotel, setHotel] = useState<Hotel | null>(null);

  const [fields, setFields] = useState({
    name: '',
    description: '',
    city: '',
    destination: '',
    address: '',
    pricePerNight: '',
    originalPrice: '',
    starRating: '',
    latitude: '',
    longitude: '',
    mainImage: '',
    galleryImages: '',
    amenities: '',
    checkInTime: '',
    checkOutTime: '',
  });

  const [mainImageAsset, setMainImageAsset] =
    useState<ImagePicker.ImagePickerAsset | null>(null);

  const [galleryImageAssets, setGalleryImageAssets] =
    useState<ImagePicker.ImagePickerAsset[]>([]);

  const [loading, setLoading] = useState(Boolean(hotelId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hotelId) return;

    let active = true;

    getPartnerHotel(hotelId)
      .then((item) => {
        if (!active) return;

        setHotel(item);

        setFields({
          name: item.name,
          description: item.description ?? '',
          city: item.city,
          destination: item.destination ?? '',
          address: item.address,
          pricePerNight: String(item.pricePerNight),
          originalPrice: item.originalPrice
            ? String(item.originalPrice)
            : '',
          starRating: item.starRating
            ? String(item.starRating)
            : '',
          latitude: item.latitude ? String(item.latitude) : '',
          longitude: item.longitude ? String(item.longitude) : '',
          mainImage: item.mainImage ?? '',
          galleryImages: item.galleryImages.join(', '),
          amenities: item.amenities.join(', '),
          checkInTime: item.checkInTime ?? '',
          checkOutTime: item.checkOutTime ?? '',
        });
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(hotelErrorMessage(reason, 'management'));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [hotelId]);

  const set =
    (key: keyof typeof fields) =>
    (value: string) =>
      setFields((current) => ({
        ...current,
        [key]: value,
      }));

  const pickMainImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        setMainImageAsset(result.assets[0]);
        setError(null);
      }
    } catch {
      setError('Unable to open the image picker.');
    }
  };

  const pickGalleryImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 10,
        quality: 0.8,
      });

      if (!result.canceled) {
        setGalleryImageAssets(result.assets);
        setError(null);
      }
    } catch {
      setError('Unable to select gallery images.');
    }
  };


  const save = async () => {
    console.log('CREATE HOTEL: Save started');

    setSaving(true);
    setError(null);

    try {
      if (!fields.name.trim()) {
        throw new Error('Please enter hotel name.');
      }

      if (!fields.city.trim()) {
        throw new Error('Please enter city.');
      }

      if (!fields.address.trim()) {
        throw new Error('Please enter street address.');
      }
      console.log('DEBUG STARTING PRICE:', JSON.stringify(fields.pricePerNight));

      if (
        !fields.pricePerNight.trim() ||
        !Number.isFinite(Number(fields.pricePerNight)) ||
        Number(fields.pricePerNight) <= 0
      ) {
        throw new Error('Please enter a valid starting price.');
      }

      console.log('CREATE HOTEL: Validation passed');

      let mainImage = fields.mainImage.trim();

      let galleryImages = fields.galleryImages
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      if (mainImageAsset) {
        console.log('CREATE HOTEL: Uploading main image');

        const uploaded = await uploadPartnerHotelImages([
          mainImageAsset,
        ]);

        mainImage = uploaded[0].url;
        console.log('CREATE HOTEL: Main image uploaded');
      }

      if (galleryImageAssets.length > 0) {
        console.log('CREATE HOTEL: Uploading gallery images');

        const uploaded = await uploadPartnerHotelImages(
          galleryImageAssets,
        );

        galleryImages = [
          ...galleryImages,
          ...uploaded.map((image) => image.url),
        ];

        console.log('CREATE HOTEL: Gallery images uploaded');
      }

      const input: HotelInput = {
        name: fields.name.trim(),
        description: fields.description.trim(),
        city: fields.city.trim(),
        destination: fields.destination.trim(),
        address: fields.address.trim(),
        pricePerNight: Number(fields.pricePerNight),
        ...(fields.starRating
          ? { starRating: Number(fields.starRating) }
          : {}),
        ...(fields.originalPrice.trim()
          ? { originalPrice: Number(fields.originalPrice) }
          : {}),
        ...(fields.latitude.trim()
          ? { latitude: Number(fields.latitude) }
          : {}),
        ...(fields.longitude.trim()
          ? { longitude: Number(fields.longitude) }
          : {}),
        mainImage: mainImage || null,
        galleryImages,
        amenities: fields.amenities
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        ...(fields.checkInTime.trim()
          ? { checkInTime: fields.checkInTime.trim() }
          : {}),
        ...(fields.checkOutTime.trim()
          ? { checkOutTime: fields.checkOutTime.trim() }
          : {}),
      };

      console.log('CREATE HOTEL: Sending API request');

      const result = hotelId
        ? await updatePartnerHotel(hotelId, input)
        : await createPartnerHotel(input);

      console.log('CREATE HOTEL: API success', result);

      setHotel(result);
      setMainImageAsset(null);
      setGalleryImageAssets([]);

      setFields((current) => ({
        ...current,
        mainImage: result.mainImage ?? mainImage,
        galleryImages: (result.galleryImages ?? galleryImages).join(', '),
      }));

      onSaved?.(result);
    } catch (reason) {
      console.error('CREATE HOTEL ERROR:', reason);
      setError(hotelErrorMessage(reason, 'management'));
    } finally {
      setSaving(false);
      console.log('CREATE HOTEL: Save finished');
    }
  };



  const deactivate = async () => {
    if (!hotel) return;

    setSaving(true);
    setError(null);

    try {
      setHotel(await updatePartnerHotelStatus(hotel.id, false));
      onInactive?.();
    } catch (reason) {
      setError(hotelErrorMessage(reason, 'management'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Loader label="Loading hotel" fullScreen />;
  }

  const displayedMainImage =
    mainImageAsset?.uri || fields.mainImage;

  const existingGalleryImages = fields.galleryImages
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text accessibilityRole="header" style={styles.title}>
          {hotelId ? 'Edit hotel' : 'Add a hotel'}
        </Text>

        {error ? <ErrorView message={error} /> : null}

        <Input
          label="Hotel name"
          value={fields.name}
          onChangeText={set('name')}
          maxLength={200}
        />

        <Input
          label="Description"
          value={fields.description}
          onChangeText={set('description')}
          multiline
          inputStyle={styles.multiline}
        />

        <Input
          label="City"
          value={fields.city}
          onChangeText={set('city')}
        />

        <Input
          label="Destination"
          value={fields.destination}
          onChangeText={set('destination')}
        />

        <Input
          label="Street address"
          value={fields.address}
          onChangeText={set('address')}
          multiline
          inputStyle={styles.multiline}
        />

        <Input
          label="Starting price per night"
          value={fields.pricePerNight}
          onChangeText={set('pricePerNight')}
          keyboardType="decimal-pad"
        />

        <Input
          label="Original price (optional)"
          value={fields.originalPrice}
          onChangeText={set('originalPrice')}
          keyboardType="decimal-pad"
        />

        <Input
          label="Star rating (optional)"
          value={fields.starRating}
          onChangeText={set('starRating')}
          keyboardType="number-pad"
        />

        <View style={styles.pair}>
          <Input
            label="Latitude (optional)"
            value={fields.latitude}
            onChangeText={set('latitude')}
            keyboardType="decimal-pad"
          />

          <Input
            label="Longitude (optional)"
            value={fields.longitude}
            onChangeText={set('longitude')}
            keyboardType="decimal-pad"
          />
        </View>

        <Text style={styles.sectionTitle}>Main hotel image</Text>

        <Button
          title="Choose main image"
          onPress={() => void pickMainImage()}
          disabled={saving}
          fullWidth
        />

        {displayedMainImage ? (
          <Image
            source={{ uri: displayedMainImage }}
            style={styles.mainPreview}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.note}>
            No main image selected.
          </Text>
        )}

        <Text style={styles.sectionTitle}>Gallery images</Text>

        <Button
          title="Choose gallery images"
          onPress={() => void pickGalleryImages()}
          disabled={saving}
          fullWidth
        />

        {existingGalleryImages.length > 0 ||
        galleryImageAssets.length > 0 ? (
          <View style={styles.gallery}>
            {existingGalleryImages.map((uri, index) => (
              <Image
                key={`existing-${index}`}
                source={{ uri }}
                style={styles.thumbnail}
                resizeMode="cover"
              />
            ))}

            {galleryImageAssets.map((asset, index) => (
              <Image
                key={`selected-${index}`}
                source={{ uri: asset.uri }}
                style={styles.thumbnail}
                resizeMode="cover"
              />
            ))}
          </View>
        ) : (
          <Text style={styles.note}>
            No gallery images selected.
          </Text>
        )}

        {galleryImageAssets.length > 0 ? (
          <Text style={styles.note}>
            {galleryImageAssets.length} new gallery image(s) selected.
          </Text>
        ) : null}

        <Input
          label="Amenities (comma separated)"
          value={fields.amenities}
          onChangeText={set('amenities')}
        />

        <View style={styles.pair}>
          <Input
            label="Check-in (HH:mm)"
            value={fields.checkInTime}
            onChangeText={set('checkInTime')}
          />

          <Input
            label="Check-out (HH:mm)"
            value={fields.checkOutTime}
            onChangeText={set('checkOutTime')}
          />
        </View>

        <Text style={styles.note}>
          New hotel listings are created inactive and must be
          activated by an administrator.
        </Text>

        <Button
          title={hotelId ? 'Save changes' : 'Create hotel'}
          onPress={() => void save()}
          loading={saving}
          fullWidth
        />

        {hotel?.isActive ? (
          <Button
            title="Deactivate hotel"
            variant="danger"
            onPress={() => void deactivate()}
            disabled={saving}
            fullWidth
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.medium,
    gap: spacing.medium,
    paddingBottom: spacing.xxxlarge,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  pair: {
    flexDirection: 'row',
    gap: spacing.small,
  },
  mainPreview: {
    width: '100%',
    height: 190,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  gallery: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.small,
  },
  thumbnail: {
    width: 100,
    height: 100,
    borderRadius: 10,
  },
  note: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
});
