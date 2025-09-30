import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { useTheme } from '../../contexts/ThemeContext';
import { getTheme } from '../../styles/theme';
import Ionicons from '@expo/vector-icons/Ionicons';

const EditProfileScreen = ({ navigation }) => {
  const { user } = useSelector(state => state.auth);
  const { isDark } = useTheme();
  const theme = getTheme(isDark);

  const [formData, setFormData] = useState({
    name: user?.name || '',
    bio: 'Exploring my local community through Pulse. Love connecting with neighbors! 🌟',
    location: 'Jaipur, Rajasthan',
    website: '',
  });

  const handleSave = () => {
    Alert.alert(
      'Profile Updated',
      'Your profile changes have been saved successfully!',
      [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  const inputFields = [
    {
      id: 'name',
      label: 'Display Name',
      placeholder: 'Enter your display name',
      icon: 'person-outline',
      multiline: false,
    },
    {
      id: 'bio',
      label: 'Bio',
      placeholder: 'Tell people about yourself',
      icon: 'document-text-outline',
      multiline: true,
    },
    {
      id: 'location',
      label: 'Location',
      placeholder: 'City, State/Country',
      icon: 'location-outline',
      multiline: false,
    },
    {
      id: 'website',
      label: 'Website',
      placeholder: 'https://yourwebsite.com',
      icon: 'link-outline',
      multiline: false,
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Photo Section */}
        <View style={[styles.photoSection, { 
          backgroundColor: theme.colors.surface,
          shadowColor: theme.colors.shadow,
        }]}>
          <View style={[styles.avatar, { backgroundColor: theme.colors.primary + '20' }]}>
            <Text style={[styles.avatarText, { color: theme.colors.primary }]}>
              {formData.name?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
          <TouchableOpacity 
            style={[styles.changePhotoButton, { backgroundColor: theme.colors.primary }]}
          >
            <Ionicons name="camera" size={20} color="#FFFFFF" />
            <Text style={styles.changePhotoText}>Change Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Form Fields */}
        <View style={[styles.formSection, { 
          backgroundColor: theme.colors.surface,
          shadowColor: theme.colors.shadow,
        }]}>
          {inputFields.map((field) => (
            <View key={field.id} style={styles.fieldContainer}>
              <View style={styles.fieldHeader}>
                <Ionicons 
                  name={field.icon} 
                  size={20} 
                  color={theme.colors.textSecondary} 
                />
                <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>
                  {field.label}
                </Text>
              </View>
              <TextInput
                style={[
                  styles.input,
                  field.multiline && styles.multilineInput,
                  {
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                  }
                ]}
                placeholder={field.placeholder}
                placeholderTextColor={theme.colors.textSecondary}
                value={formData[field.id]}
                onChangeText={(text) => setFormData({ ...formData, [field.id]: text })}
                multiline={field.multiline}
                numberOfLines={field.multiline ? 3 : 1}
              />
            </View>
          ))}
        </View>

        {/* Privacy Note */}
        <View style={[styles.privacySection, { 
          backgroundColor: theme.colors.surface,
          shadowColor: theme.colors.shadow,
        }]}>
          <Ionicons 
            name="shield-checkmark" 
            size={24} 
            color={theme.colors.success} 
          />
          <View style={styles.privacyText}>
            <Text style={[styles.privacyTitle, { color: theme.colors.text }]}>
              Privacy Protected
            </Text>
            <Text style={[styles.privacySubtitle, { color: theme.colors.textSecondary }]}>
              Your profile is only visible to users within your selected radius
            </Text>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity 
          style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  photoSection: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    marginBottom: 16,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '700',
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  changePhotoText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  formSection: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  multilineInput: {
    height: 80,
  },
  privacySection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  privacyText: {
    flex: 1,
    marginLeft: 12,
  },
  privacyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  privacySubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  saveButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 32,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default EditProfileScreen;
